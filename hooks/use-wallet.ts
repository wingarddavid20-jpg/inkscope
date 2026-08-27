'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  INK_CHAIN_ID,
  getEthereumProvider,
  connectWallet as connectWalletUtil,
  switchOrAddInkNetwork,
} from '@/lib/wallet';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected on initial load
  useEffect(() => {
    const checkConnection = async () => {
      const ethereum = getEthereumProvider();
      if (!ethereum) return;

      try {
        const provider = new ethers.BrowserProvider(ethereum);
        const accounts: string[] = await provider.send('eth_accounts', []);
        const network = await provider.getNetwork();
        setChainId(Number(network.chainId));

        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setConnected(true);
        }
      } catch (err) {
        console.error('Error checking existing wallet connection:', err);
      }
    };

    checkConnection();
  }, []);

  // Listen to provider events (accountsChanged, chainChanged)
  useEffect(() => {
    const ethereum = getEthereumProvider();
    if (!ethereum || !ethereum.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setConnected(false);
      } else {
        setAddress(accounts[0]);
        setConnected(true);
      }
    };

    const handleChainChanged = (newChainIdHex: string) => {
      const parsedChainId = parseInt(newChainIdHex, 16);
      setChainId(parsedChainId);
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { address: userAddress, provider } = await connectWalletUtil();
      setAddress(userAddress);
      setConnected(true);
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      const message = err?.message || 'Failed to connect wallet';
      setError(message);
      // If user has no wallet, show user friendly alert
      if (typeof window !== 'undefined' && !getEthereumProvider()) {
        alert('No Web3 wallet found. Please install MetaMask, Rabby, or Coinbase Wallet.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setConnected(false);
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await switchOrAddInkNetwork();
    } catch (err: any) {
      console.error('Network switch error:', err);
      setError(err?.message || 'Failed to switch network');
    }
  }, []);

  return {
    address,
    connected,
    isConnecting,
    chainId,
    isInkNetwork: chainId === INK_CHAIN_ID,
    error,
    connect,
    disconnect,
    switchNetwork,
  };
}
