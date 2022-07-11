/* eslint-disable jest/valid-expect */
/* eslint-disable no-undef */
const { expect } = require( "chai" );
const { ethers } = require("hardhat");

const toWei = ( num ) => ethers.utils.parseEther( num.toString() );
const fromWei = ( num ) => ethers.utils.formatEther( num );

describe( "nftMarketplace", () => {
    let deployer, addr1, addr2, NFT_instance, marketPlace_instance;
    let feePercent = 1;
    let URI = "Sample URI";

    beforeEach( async () => {

        // Get contract factories
        const NFT_deployer = await ethers.getContractFactory( "NFT" );
        const marketPlace_deployer = await ethers.getContractFactory( "Marketplace" );

        // Get signers
        [ deployer, addr1, addr2 ] = await ethers.getSigners();

        //  Deploy contracts
        NFT_instance = await NFT_deployer.deploy();
        marketPlace_instance = await marketPlace_deployer.deploy( feePercent );

    } );

    describe( "Deployment", () => {

        it( "Should track name and symbol of NFT collection", async function() {
            expect(await NFT_instance.name()).to.equal( "Dev NFT" );
            expect(await NFT_instance.symbol()).to.equal( "D_NFT" );
        });

        it( "Should track feeAccount and feePercent of NFT marketplace", async function() {
            expect(await marketPlace_instance.feeAccount()).to.equal( deployer.address );
            expect(await marketPlace_instance.feePercent()).to.equal( feePercent );
        });
    });

    describe( "Minting NFTs", () => {

        it( "Should tract each minted NFT", async function() {
            // addr1 mints an NFT
            await NFT_instance.connect( addr1 ).mint( URI );
            expect( await NFT_instance.tokenCount() ).to.equal( 1 );
            expect( await NFT_instance.balanceOf( addr1.address ) ).to.equal( 1 );
            expect( await NFT_instance.tokenURI( 1 ) ).to.equal( URI );

            // addr1 mints an NFT
            await NFT_instance.connect( addr2 ).mint( URI );
            expect( await NFT_instance.tokenCount() ).to.equal( 2 );
            expect( await NFT_instance.balanceOf( addr2.address ) ).to.equal( 1 );
            expect( await NFT_instance.tokenURI( 2 ) ).to.equal( URI );
        } );
    });

    describe( "Making marketplace items", function() {
        beforeEach( async function() {
            // addr1 mints an NFT
            await NFT_instance.connect( addr1 ).mint( URI );

            // addr1 approves marketplace to spend nft
            await NFT_instance.connect( addr1 ).setApprovalForAll( marketPlace_instance.address, true );
        });

        it( "Should track newly created item, transfer NFT from seller to marketplace and emit Offered event", async function () {
            //addr1 offers their nft at a price of 1 ether

            await expect( marketPlace_instance.connect( addr1 ).makeItem( NFT_instance.address, 1, toWei( 1 )))
            .to.emit( marketPlace_instance, "Offered" )
            .withArgs( 1, NFT_instance.address, 1, toWei( 1 ), addr1.address )

            // Owner of the nft should now be the marketplace
            expect( await NFT_instance.ownerOf( 1 ) ).to.equal( marketPlace_instance.address );

            //Item count should be 1
            expect( await marketPlace_instance.itemCount() ).to.equal( 1 );

            // Get item form items mapping and check fields to ensure correctness
            const item = await marketPlace_instance.items( 1 );

            expect( item.itemId ).to.equal( 1 );
            expect( item.nft ).to.equal( NFT_instance.address );
            expect( item.tokenId ).to.equal( 1 );
            expect( item.price ).to.equal( toWei( 1 ) );
            expect( item.sold ).to.equal( false );

        });

        it( "Should fail if the price is set to zero", async function() {
            await expect( marketPlace_instance.connect( addr1 ).makeItem( NFT_instance.address, 1, 0 ) ).to.be.revertedWith( "Price must be greater than zero" );
        });
    });

    describe( "Purchasing marketplace items", function() {

        const price = 2;
        // fetch items total price ( market fees + item price )
        let totalPriceInWei;

        beforeEach( async function() {
            // addr1 mints an NFT
            await NFT_instance.connect( addr1 ).mint( URI );

            // addr1 approves marketplace to spend nft
            await NFT_instance.connect( addr1 ).setApprovalForAll( marketPlace_instance.address, true );

            // addr1 makes their nft a marketplace item.
            await marketPlace_instance.connect( addr1 ).makeItem( NFT_instance.address, 1, toWei( price ) );
        });

        it( "Should upadate item as sold, pay seller, transfer NFT to buyer, charge fees and emit a Bought event", async function() {

            const sellerinitialEthBal = await addr1.getBalance();
            const feeAccountInitialEthBal = await deployer.getBalance();
            
            totalPriceInWei = await marketPlace_instance.getTotalPrice( 1 );
            
            await expect( marketPlace_instance.connect( addr2 ).purchaseItem( 1, { value: totalPriceInWei } ) ).to.emit( marketPlace_instance, "Bought" )
                .withArgs( 1, NFT_instance.address, 1, toWei( price ), addr1.address, addr2.address );
    
            const selleFinalEthBal = await addr1.getBalance();
            const feeAccountFinalEthBal = await deployer.getBalance();
    
            // Seller should receive payment for the price of the NFT sold.
            expect( +fromWei( selleFinalEthBal ) ).to.equal( +price + +fromWei( sellerinitialEthBal ));
    
            // Calculate fee
            const fee = ( feePercent / 100 ) * price
            
            // feeAccount should receive fee
            expect( +fromWei( feeAccountFinalEthBal ) ).to.equal( +fee + +fromWei((feeAccountInitialEthBal ) ));
    
            // The buyer shoud now own the sold nft
            expect( await NFT_instance.ownerOf( 1 ) ).to.equal( addr2.address );
    
            // item should be marked as sold
            expect( ( await marketPlace_instance.items( 1 ) ).sold ).to.equal( true );
        });

        it( "Should fail for invalid item Ids, sold items and when not enough ether is paid", async function() {

            // fails for invalid item Ids
            await expect( marketPlace_instance.connect( addr2 ).purchaseItem( 2, { value: totalPriceInWei } ) )
            .to.be.revertedWith( "item doesn't exist" );

            await expect( marketPlace_instance.connect( addr2 ).purchaseItem( 0, { value: totalPriceInWei } ) )
            .to.be.revertedWith( "item doesn't exist" );

            // fails when not enough ether is paid with the transaction
            await expect( marketPlace_instance.connect( addr2 ).purchaseItem( 1, { value: toWei( price ) } ) )
            .to.be.revertedWith( "not enough ether to cover token price and market fee" );

            // addr2 purchases item 1 
            marketPlace_instance.connect( addr2 ).purchaseItem( 1, { value: totalPriceInWei } );

            // deployer tries to purchase item 1 after it being sold out
            await expect( marketPlace_instance.connect( deployer ).purchaseItem( 1, { value: totalPriceInWei } ) )
            .to.be.revertedWith( "item already sold" );

        });
    });

})