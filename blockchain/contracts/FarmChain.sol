// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FarmChain {
    struct Product {
        uint256 id;
        string name;
        string category;
        string batchNumber;
        uint256 quantity;
        address farmer;
        address currentOwner;
        string status; // e.g., "Harvested", "Processed", "In Transit", "Retail"
        uint256 timestamp;
    }

    struct HistoryEvent {
        string status;
        address owner;
        uint256 timestamp;
        string extraInfo; // IPFS hash or metadata
    }

    uint256 public productCount;
    mapping(uint256 => Product) public products;
    mapping(uint256 => HistoryEvent[]) public productHistory;

    event ProductRegistered(uint256 indexed productId, string name, address indexed farmer);
    event StageUpdated(uint256 indexed productId, string status, address indexed owner);
    event OwnershipTransferred(uint256 indexed productId, address indexed oldOwner, address indexed newOwner);

    function registerProduct(
        string memory _name,
        string memory _category,
        string memory _batchNumber,
        uint256 _quantity,
        string memory _initialStatus
    ) public {
        productCount++;
        products[productCount] = Product(
            productCount,
            _name,
            _category,
            _batchNumber,
            _quantity,
            msg.sender,
            msg.sender,
            _initialStatus,
            block.timestamp
        );

        productHistory[productCount].push(HistoryEvent(
            _initialStatus,
            msg.sender,
            block.timestamp,
            "Registration"
        ));

        emit ProductRegistered(productCount, _name, msg.sender);
    }

    function updateStage(uint256 _productId, string memory _status, string memory _extraInfo) public {
        require(_productId > 0 && _productId <= productCount, "Invalid product ID");
        require(products[_productId].currentOwner == msg.sender, "Only current owner can update stage");

        products[_productId].status = _status;
        products[_productId].timestamp = block.timestamp;

        productHistory[_productId].push(HistoryEvent(
            _status,
            msg.sender,
            block.timestamp,
            _extraInfo
        ));

        emit StageUpdated(_productId, _status, msg.sender);
    }

    function transferOwnership(uint256 _productId, address _newOwner, string memory _status) public {
        require(_productId > 0 && _productId <= productCount, "Invalid product ID");
        require(products[_productId].currentOwner == msg.sender, "Only current owner can transfer");
        require(_newOwner != address(0), "Invalid new owner");

        address oldOwner = products[_productId].currentOwner;
        products[_productId].currentOwner = _newOwner;
        products[_productId].status = _status;
        products[_productId].timestamp = block.timestamp;

        productHistory[_productId].push(HistoryEvent(
            _status,
            _newOwner,
            block.timestamp,
            "Ownership Transferred"
        ));

        emit OwnershipTransferred(_productId, oldOwner, _newOwner);
    }

    function getProductHistory(uint256 _productId) public view returns (HistoryEvent[] memory) {
        require(_productId > 0 && _productId <= productCount, "Invalid product ID");
        return productHistory[_productId];
    }
}
