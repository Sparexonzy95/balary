// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITeeExtensionRegistry {
    struct TeeInstructionParams {
        bytes32 opType;
        bytes32 opCommand;
        bytes message;
        address[] cosigners;
        uint64 cosignersThreshold;
        address claimBackAddress;
    }

    function getTeeExtensionInstructionsSender(uint256 extensionId)
        external
        view
        returns (address);

    function sendInstructions(
        address[] calldata teeIds,
        TeeInstructionParams calldata params
    ) external payable returns (bytes32 instructionId);
}

interface ITeeMachineRegistry {
    function getRandomTeeIds(uint256 extensionId, uint256 count)
        external
        returns (address[] memory teeIds);
}
