// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITeeExtensionRegistry, ITeeMachineRegistry} from "../interfaces/IFlareTee.sol";

contract MockTeeExtensionRegistry is ITeeExtensionRegistry {
    uint256 public constant EXTENSION_ID = 0x10000;
    uint256 public nonce;

    mapping(uint256 => address) public instructionSenders;

    event MockInstructionSent(
        bytes32 indexed instructionId,
        address indexed sender,
        address indexed teeId,
        bytes32 opCommand,
        bytes message
    );

    function setInstructionSender(address sender) external {
        instructionSenders[EXTENSION_ID] = sender;
    }

    function getTeeExtensionInstructionsSender(uint256 extensionId)
        external
        view
        override
        returns (address)
    {
        return instructionSenders[extensionId];
    }

    function sendInstructions(
        address[] calldata teeIds,
        TeeInstructionParams calldata params
    ) external payable override returns (bytes32 instructionId) {
        instructionId = bytes32(++nonce);
        address teeId = teeIds.length == 0 ? address(0) : teeIds[0];
        emit MockInstructionSent(
            instructionId,
            msg.sender,
            teeId,
            params.opCommand,
            params.message
        );
    }
}

contract MockTeeMachineRegistry is ITeeMachineRegistry {
    address public teeId;

    constructor(address initialTeeId) {
        teeId = initialTeeId;
    }

    function setTeeId(address newTeeId) external {
        teeId = newTeeId;
    }

    function getRandomTeeIds(uint256, uint256 count)
        external
        override
        returns (address[] memory teeIds)
    {
        teeIds = new address[](count);
        for (uint256 i = 0; i < count; ++i) {
            teeIds[i] = teeId;
        }
    }
}
