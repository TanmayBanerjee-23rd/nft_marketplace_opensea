// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Marketplace is ReentrancyGuard {

    //state Variables
        address payable public immutable feeAccount; // the account the receives fees
        uint public immutable feePercent; // fee percentage on sales
        uint public itemCount;

        struct Item{
            uint itemId;
            IERC721 nft;
            uint tokenId;
            uint price;
            address payable seller;
            bool sold;
        }

        event Offered (
            uint itemId,
            address indexed nft,
            uint tokenId,
            uint price,
            address indexed seller
        );

        event Bought (
            uint itemId,
            address indexed nft,
            uint tokenId,
            uint price,
            address indexed seller,
            address indexed buyer
        );

        // itemId -> item
        mapping( uint => Item ) public items;

        constructor( uint _feePercent ) {
            feeAccount = payable( msg.sender );
            feePercent = _feePercent;
        }

        function makeItem( IERC721 _nft, uint _tokenId, uint _price ) external nonReentrant {
            require( _price > 0, "Price must be greater than zero");

            //increment tokenCount

            itemCount++;

            //transfer nft
            _nft.transferFrom( msg.sender, address( this ), _tokenId );

            //add new item to items mapping
            items[ itemCount ] = Item (
                itemCount,
                _nft,
                _tokenId,
                _price,
                payable( msg.sender ),
                false
            );

            // emit Offered event
            emit Offered (
                itemCount,
                address( _nft ),
                _tokenId,
                _price,
                msg.sender
            );
        }

        function purchaseItem( uint _itemId ) external payable nonReentrant {
            uint _totalPrice = getTotalPrice( _itemId );

            Item storage item = items[ _itemId ];

            require( _itemId > 0 && _itemId <= itemCount, "item doesn't exist" );
            require( msg.value >= _totalPrice, "not enough ether to cover token price and market fee" );
            require( !item.sold, "item already sold" );

            // pay seller and feeAccount
            item.seller.transfer( item.price );
            feeAccount.transfer( _totalPrice - item.price );

            // update the item as sold
            item.sold = true;

            // transfer nft to buyer
            item.nft.transferFrom( address( this ), msg.sender, item.tokenId );

            emit Bought (
                _itemId,
                address( item.nft ),
                item.tokenId,
                item.price,
                item.seller,
                msg.sender
            );
        }

        function getTotalPrice( uint _itemId ) view public returns( uint ) {
            return ( items[ _itemId ].price * ( 100 +feePercent ) / 100 );
        }
        
    
}