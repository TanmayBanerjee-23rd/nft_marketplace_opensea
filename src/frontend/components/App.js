import './App.css';

import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import { ethers } from "ethers";
import { useState } from 'react';


import Home from './Home.js';
import Create from './Create.js';
import MyListedItems from './MyListedItems.js';
import MyPurchases from './MyPurchases.js';
import Navbar from "./Navbar";
import MarketplaceAddress from "../contractsData/MarketPlace-address.json";
import MarketplaceAbi from "../contractsData/Marketplace.json";
import NFTAddress from "../contractsData/NFT-address.json";
import NFTAbi from "../contractsData/NFT.json";
import { Spinner } from 'react-bootstrap';

function App() {

  const [ marketplace, setMarketplace ] = useState( {} );
  const [ nft, setNFT ] = useState( {} );

  const [ appAccount, setAppAccount ] = useState( null );

  const [ loading, setLoading ] = useState( true );

  // Metamask connect.
  const web3Handler = async () => {

    // get accouns connected to the app
    const accounts = await window.ethereum.request( { method: "eth_requestAccounts" } );
    setAppAccount( accounts[ 0 ] );

    // get provider from metamask
    const provider = new ethers.providers.Web3Provider( window.ethereum );

    // set signer
    const signer = provider.getSigner();

    window.ethereum.on( "chainChanged", ( ) => {
      window.location.reload();
    } );

    window.ethereum.on( "accountsChanged", async () => {
      await web3Handler();
    });
    
    // get access to deployed smart contract instances
    loadContracts( signer ); // abstraction of an etherium account used to sign messages and transactions and send signed 
  };

  const loadContracts = async ( signer ) => {

    // get deployed copies of contracts

    const marketplace = new ethers.Contract( MarketplaceAddress.address, MarketplaceAbi.abi, signer );
    setMarketplace( marketplace );

    const nft = new ethers.Contract( NFTAddress.address, NFTAbi.abi, signer );
    setNFT( nft );

    setLoading( false );
  };

  return (
    <BrowserRouter>
    <div className="App">
      <>
        <Navbar web3Handler={ web3Handler } account={ appAccount } />
      </>
      <div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <Spinner animation="border" style={{ display: 'flex' }} />
            <p className='mx-3 my-0'>Awaiting Metamask Connection...</p>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={
              <Home marketplace={ marketplace } nft={ nft } />
            } />
            <Route path="/create" element={
              <Create marketplace={ marketplace } nft={ nft } />
            } />
            <Route path="/my-listed-items" element={
              <MyListedItems marketplace={ marketplace } nft={ nft } account={ appAccount } />
            } />
            <Route path="/my-purchases" element={
              <MyPurchases marketplace={ marketplace } nft={ nft } account={ appAccount } />
            } />
          </Routes>
        )}
      </div>
    </div>
  </BrowserRouter>
  );
}

export default App;
