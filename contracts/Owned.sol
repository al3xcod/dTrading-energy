pragma solidity >=0.5.0 <0.6.0;


/**
 * @title Owned
 * @notice Simple owner contract.
 * @dev Is inherited by derived contracts.
 */
contract Owned {
  address payable owner;

  constructor (/*address _owner*/) public {
    owner = msg.sender;
    //owner = _owner;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Only owner may access this function.");
    _;
  }
}
