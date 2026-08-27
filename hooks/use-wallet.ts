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

  // Check if wallet is already connected on initial load, and re-check whenever
  // the tab regains focus. Wallets update their account state while the tab is
  // unfocused (e.g. the user unlocks the extension or approves the site in
  // another tab) and do NOT always fire `accountsChanged`, so a one-shot check
  // on mount can leave the UI showing "Connect Wallet" while the wallet is
  // actually connected.
  useEffect(() => {
    let cancelled = false;

    const checkConnection = async () => {
      const ethereum = getEthereumProvider();
      if (!ethereum) return;

      try {
        const provider = new ethers.BrowserProvider(ethereum);
        const accounts: string[] = await provider.send('eth_accounts', []);
        if (cancelled) return;
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setConnected(true);
        }
      } catch (err) {
        console.error('Error checking existing wallet connection:', err);
      }

      // Network info is secondary — a wallet can be connected even when this
      // call fails, so it must never block the connected state above.
      try {
        const provider = new ethers.BrowserProvider(ethereum);
        const network = await provider.getNetwork();
        if (!cancelled) setChainId(Number(network.chainId));
      } catch (err) {
        console.error('Error reading wallet network:', err);
      }
    };

    void checkConnection();

    const handleRecheck = () => {
      if (document.visibilityState === 'visible') void checkConnection();
    };
    window.addEventListener('focus', handleRecheck);
    document.addEventListener('visibilitychange', handleRecheck);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleRecheck);
    };
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
