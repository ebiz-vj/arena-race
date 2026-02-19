// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ArenaRaceEscrow
 * @notice Escrow + payout for Arena Race matches. TDD §3.1–3.13.
 * Accepts USDC entry, 8% fee to treasury, 92% pool; distributes per signed result (38/30/20/12 or tie-split).
 * No game logic; no upgradeable fund logic.
 */
contract ArenaRaceEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ---------- TDD §3.3 Match struct + §3.4 status ----------
    enum MatchStatus {
        PendingEntries, // 0–3 entries; entry window open
        Escrowed,      // 4 entries; fee deducted; pool locked
        Expired,       // Entry window elapsed without 4 entries
        Refunded,      // All received entries returned (terminal)
        Resolved       // Result submitted; payouts sent (terminal)
    }

    struct Match {
        uint256 entryAmountPerPlayer;
        uint256 totalEntry;
        uint256 feeAmount;
        uint256 poolAmount;
        address[4] playerWallets;
        uint8 entriesReceived;
        MatchStatus status;
        uint256 resultSubmittedAt;
        uint256 entryDeadline;
    }

    /// @dev TDD §3.5: matchId → Match
    mapping(bytes32 => Match) public matches;

    /// @dev TDD §3.7: per-player refund claimed (Expired → Refunded path)
    mapping(bytes32 => mapping(address => bool)) public refundClaimed;

    IERC20 public immutable usdc;
    address public treasuryWallet;

    /// @dev TDD §3.11: signer for submitResult
    address public resultSigner;

    /// @dev TDD §3.13: when true, reject new entries and new match creation
    bool public paused;

    /// @dev TDD §3.5: entry window 5 minutes from creation
    uint256 public constant ENTRY_WINDOW = 300;

    /// @dev TDD §3.6: fee 8%
    uint256 public constant FEE_BPS = 800; // 8.00%

    event MatchCreated(bytes32 indexed matchId, uint256 entryAmountPerPlayer, uint256 entryDeadline);
    event EntryReceived(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchEscrowed(bytes32 indexed matchId, uint256 feeAmount, uint256 poolAmount);
    event MatchExpired(bytes32 indexed matchId);
    event RefundClaimed(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchRefunded(bytes32 indexed matchId);
    event ResultSubmitted(bytes32 indexed matchId, uint256 resultSubmittedAt);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event Paused(address account);
    event Unpaused(address account);

    error MatchAlreadyExists();
    error MatchNotFound();
    error InvalidEntryWindow();
    error InvalidAmount();
    error AlreadyEntered();
    error NotPendingEntries();
    error PastDeadline();
    error NotExpired();
    error NotEscrowed();
    error AlreadyRefunded();
    error InvalidSignature();
    error PayoutSumMismatch();
    error ContractPaused();
    error ZeroAddress();

    constructor(address _usdc, address _treasury, address _resultSigner) Ownable(msg.sender) {
        if (_usdc == address(0) || _treasury == address(0) || _resultSigner == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        treasuryWallet = _treasury;
        resultSigner = _resultSigner;
    }

    /// @dev TDD §3.13: multisig only
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /**
     * @notice Create a match and start entry window. TDD §3.5 entry window 5 min.
     * Callable only by multisig (owner). When paused, new match creation rejected (§3.13).
     */
    function createMatch(bytes32 matchId, uint256 entryAmountPerPlayer) external onlyOwner whenNotPaused {
        if (matchId == bytes32(0)) revert InvalidEntryWindow();
        if (entryAmountPerPlayer == 0) revert InvalidAmount();
        Match storage m = matches[matchId];
        if (m.entryDeadline != 0) revert MatchAlreadyExists();

        m.entryAmountPerPlayer = entryAmountPerPlayer;
        m.totalEntry = entryAmountPerPlayer * 4;
        m.entryDeadline = block.timestamp + ENTRY_WINDOW;
        m.status = MatchStatus.PendingEntries;

        emit MatchCreated(matchId, entryAmountPerPlayer, m.entryDeadline);
    }

    /**
     * @notice Submit entry for a match. TDD §3.5 per-player entry; §3.6 fourth entry → fee + Escrowed.
     * Checks-effects-interactions (§3.10).
     */
    function submitEntry(bytes32 matchId, uint256 amount) external nonReentrant whenNotPaused {
        Match storage m = matches[matchId];
        if (m.entryDeadline == 0) revert MatchNotFound();
        if (m.status != MatchStatus.PendingEntries) revert NotPendingEntries();
        if (block.timestamp > m.entryDeadline) revert PastDeadline();
        if (amount != m.entryAmountPerPlayer) revert InvalidAmount();

        for (uint256 i = 0; i < m.entriesReceived; i++) {
            if (m.playerWallets[i] == msg.sender) revert AlreadyEntered();
        }

        m.playerWallets[m.entriesReceived] = msg.sender;
        m.entriesReceived += 1;

        // Effects before interactions (TDD §3.10)
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit EntryReceived(matchId, msg.sender, amount);

        // TDD §3.5 fourth entry: fee 8%, pool 92%, status = Escrowed
        if (m.entriesReceived == 4) {
            m.feeAmount = (m.totalEntry * FEE_BPS) / 10000;
            m.poolAmount = m.totalEntry - m.feeAmount;
            m.status = MatchStatus.Escrowed;

            usdc.safeTransfer(treasuryWallet, m.feeAmount);

            emit MatchEscrowed(matchId, m.feeAmount, m.poolAmount);
        }
    }

    /**
     * @notice Mark match as Expired when entry window passed and <4 entries. TDD §3.5 Timeout.
     * Anyone may call when conditions are met.
     */
    function expireMatch(bytes32 matchId) external {
        Match storage m = matches[matchId];
        if (m.entryDeadline == 0) revert MatchNotFound();
        if (m.status != MatchStatus.PendingEntries) revert NotPendingEntries();
        if (block.timestamp <= m.entryDeadline) revert NotExpired();
        if (m.entriesReceived >= 4) revert NotExpired();

        m.status = MatchStatus.Expired;
        emit MatchExpired(matchId);
    }

    /**
     * @notice Claim refund for an Expired match. TDD §3.7 (A) each payer calls claimRefund.
     * 100% of entry; no fee. After all who entered have claimed, status set to Refunded.
     */
    function claimRefund(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Expired) revert NotExpired();

        bool senderEntered = false;
        for (uint256 i = 0; i < m.entriesReceived; i++) {
            if (m.playerWallets[i] == msg.sender) {
                senderEntered = true;
                break;
            }
        }
        if (!senderEntered) revert AlreadyRefunded();
        if (refundClaimed[matchId][msg.sender]) revert AlreadyRefunded();

        refundClaimed[matchId][msg.sender] = true;
        usdc.safeTransfer(msg.sender, m.entryAmountPerPlayer);

        emit RefundClaimed(matchId, msg.sender, m.entryAmountPerPlayer);

        // If all who entered have claimed, set Refunded
        bool allClaimed = true;
        for (uint256 i = 0; i < m.entriesReceived; i++) {
            if (!refundClaimed[matchId][m.playerWallets[i]]) {
                allClaimed = false;
                break;
            }
        }
        if (allClaimed) {
            m.status = MatchStatus.Refunded;
            emit MatchRefunded(matchId);
        }
    }

    /**
     * @notice Server-triggered refund: transfer back to all payers, set Refunded. TDD §3.7 (B).
     * Callable only by multisig (owner).
     */
    function refundMatch(bytes32 matchId) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Expired) revert NotExpired();

        for (uint256 i = 0; i < m.entriesReceived; i++) {
            address player = m.playerWallets[i];
            if (!refundClaimed[matchId][player]) {
                refundClaimed[matchId][player] = true;
                usdc.safeTransfer(player, m.entryAmountPerPlayer);
                emit RefundClaimed(matchId, player, m.entryAmountPerPlayer);
            }
        }
        m.status = MatchStatus.Refunded;
        emit MatchRefunded(matchId);
    }

    /// @dev TDD §3.8: 38% / 30% / 20% / 12% of pool for 1st / 2nd / 3rd / 4th
    uint256 private constant BPS_1ST = 3800;
    uint256 private constant BPS_2ND = 3000;
    uint256 private constant BPS_3RD = 2000;
    uint256 private constant BPS_4TH = 1200;

    /**
     * @notice Submit signed result with placement; contract computes 38/30/20/12. TDD §3.8.
     * placement[0]=player index 1st, placement[1]=2nd, placement[2]=3rd, placement[3]=4th.
     */
    function submitResultWithPlacement(
        bytes32 matchId,
        uint8[4] calldata placement,
        bytes calldata signature
    ) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.entryDeadline == 0) revert MatchNotFound();
        if (m.status != MatchStatus.Escrowed) revert NotEscrowed();

        bytes32 messageHash = keccak256(
            abi.encodePacked(matchId, placement[0], placement[1], placement[2], placement[3])
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        address signer = ecrecover(ethSignedHash, v, r, s);
        if (signer != resultSigner) revert InvalidSignature();

        uint256 pool = m.poolAmount;
        uint256 a0 = (pool * BPS_1ST) / 10000;
        uint256 a1 = (pool * BPS_2ND) / 10000;
        uint256 a2 = (pool * BPS_3RD) / 10000;
        uint256 a3 = pool - a0 - a1 - a2; // remainder to avoid rounding dust

        m.status = MatchStatus.Resolved;
        m.resultSubmittedAt = block.timestamp;

        usdc.safeTransfer(m.playerWallets[placement[0]], a0);
        usdc.safeTransfer(m.playerWallets[placement[1]], a1);
        usdc.safeTransfer(m.playerWallets[placement[2]], a2);
        usdc.safeTransfer(m.playerWallets[placement[3]], a3);

        emit ResultSubmitted(matchId, m.resultSubmittedAt);
    }

    /**
     * @notice Submit signed result with exact payout amounts. TDD §3.8, §3.9.
     * Payouts are in playerWallets order; sum must equal poolAmount. Use for tie-split (server sends amounts).
     * When paused, submitResult and refundMatch still allowed (§3.13).
     */
    function submitResult(
        bytes32 matchId,
        uint256[4] calldata payoutAmounts,
        bytes calldata signature
    ) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.entryDeadline == 0) revert MatchNotFound();
        if (m.status != MatchStatus.Escrowed) revert NotEscrowed();

        uint256 sum = payoutAmounts[0] + payoutAmounts[1] + payoutAmounts[2] + payoutAmounts[3];
        if (sum != m.poolAmount) revert PayoutSumMismatch();

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                matchId,
                payoutAmounts[0],
                payoutAmounts[1],
                payoutAmounts[2],
                payoutAmounts[3]
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        address signer = ecrecover(ethSignedHash, v, r, s);
        if (signer != resultSigner) revert InvalidSignature();

        m.status = MatchStatus.Resolved;
        m.resultSubmittedAt = block.timestamp;

        for (uint256 i = 0; i < 4; i++) {
            if (payoutAmounts[i] > 0) {
                usdc.safeTransfer(m.playerWallets[i], payoutAmounts[i]);
            }
        }

        emit ResultSubmitted(matchId, m.resultSubmittedAt);
    }

    function _splitSignature(bytes memory signature) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(signature.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
    }

    /// @notice TDD §3.11: set result signer. Multisig only.
    function setResultSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address oldSigner = resultSigner;
        resultSigner = newSigner;
        emit SignerUpdated(oldSigner, newSigner);
    }

    /// @notice TDD §3.13: pause. Multisig only. Reject new entries and new match creation.
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice TDD §3.13: unpause.
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }
}
