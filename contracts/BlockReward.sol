// Copyright 2018 Parity Technologies (UK) Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Example block reward contract.

pragma solidity ^0.5.0;

import "./IBlockReward.sol";
import "./IFakeUtility.sol";


contract BlockReward is IBlockReward {
  uint256 public constant REWARD_AMOUNT = 1 ether;
  address public constant UTILITY_CONTRACT = 0x0000000000000000000000000000000000000043;
  uint8 public constant NETTING_INTERVAL = 5;

  uint256 public latestNettingBlockNumber = 0;

  modifier onlySystem {
    require(
      msg.sender == 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE,
      "BlockReward: caller is not sytem"
    );
    _;
  }

  // produce rewards for the given benefactors, with corresponding reward codes.
  // only callable by `SYSTEM_ADDRESS`
  function reward(address[] calldata benefactors, uint16[] calldata kind)
    external
    onlySystem
    returns (address[] memory, uint256[] memory)
  {
    require(
      benefactors.length == kind.length,
      "BlockReward: length mismatch of benefactors and kind"
    );

    uint256[] memory rewards = new uint256[](benefactors.length);

    for (uint i = 0; i < rewards.length; i++) {
      rewards[i] = REWARD_AMOUNT;
    }

    if (block.number - latestNettingBlockNumber >= NETTING_INTERVAL) {
      latestNettingBlockNumber = block.number;
      IFakeUtility fakeUtility = IFakeUtility(UTILITY_CONTRACT);
      fakeUtility.netting();
    }

    return (benefactors, rewards);
  }
}
