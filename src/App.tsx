import * as React from 'react';
import styled from 'styled-components';

import Web3Modal from 'web3modal';
// @ts-ignore
import WalletConnectProvider from '@walletconnect/web3-provider';
import Column from './components/Column';
import Wrapper from './components/Wrapper';
import Header from './components/Header';
import Loader from './components/Loader';
import ConnectButton from './components/ConnectButton';

import { Web3Provider } from '@ethersproject/providers';
import { getChainData, showNotification } from './helpers/utilities';
import {
  BOOK_LIBRARY_ADDRESS
} from './constants';
import BOOK_LIBRARY from './constants/abi/BookLibrary.json';
import LIB_TOKEN from './constants/abi/LibToken.json';
import WRAPPER_CONTRACT from './constants/abi/WrapperContract.json';
import { getContract } from './helpers/ethers';
import { logMsg } from './helpers/dev';
import AddBookForm from './components/ResultSubmitForm';
import BooksList from './components/BooksList';
import ErrorMessage from './components/ErrorMessage';
import { ethers } from 'ethers';

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

const SContent = styled(Wrapper)`
  width: 100%;
  height: 100%;
  padding: 0 16px;
`;

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

const SLanding = styled(Column)`
  height: 600px;
`;

// @ts-ignore
const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

interface IAppState {
  fetching: boolean;
  address: string;
  tokenAddress: string;
  wrapperAddress: string;
  library: any;
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  result: any | null;
  info: any | null;
  bookLibraryContract: any | null;
  wrapperContract: any | null;
  tokenContract: any | null;
  errorFlag: any | null;
  errorMessage: any | null;
  transactionHash: any | null;
  availableBooks: any | null;
  borrowedBooks: any | null;
  fetchingAddBook: boolean;
  fetchingBooksList: boolean;
  fetchingBorrowBook: boolean;
  fetchingBorrowedBooksList: boolean;
  fetchingReturnBook: boolean;
  fetchingunWrapTokens: boolean;
  userBalance: any | null;
  contractBalance: any | null;
  contractETHBalance: any | null;
  rentPrice: any | null;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: '',
  tokenAddress: '',
  wrapperAddress: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  result: null,
  info: null,
  bookLibraryContract: null,
  wrapperContract: null,
  tokenContract: null,
  errorFlag: null,
  errorMessage: null,
  transactionHash: null,
  availableBooks: null,
  borrowedBooks: null,
  fetchingAddBook: false,
  fetchingBooksList: false,
  fetchingBorrowBook: false,
  fetchingBorrowedBooksList: false,
  fetchingReturnBook: false,
  fetchingunWrapTokens: false,
  userBalance: null,
  contractBalance: null,
  contractETHBalance: null,
  rentPrice: null
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions()
    });
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
  }

  public onConnect = async () => {
    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const network = await library.getNetwork();

    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];
    const bookLibraryContract = getContract(BOOK_LIBRARY_ADDRESS, BOOK_LIBRARY.abi, library, address);

    const tokenAddress = await bookLibraryContract.LIBToken();
    const tokenContract = getContract(tokenAddress, LIB_TOKEN.abi, library, address);
    logMsg(tokenAddress)

    const wrapperAddress = await bookLibraryContract.wrapperContract();

    logMsg(wrapperAddress)

    const wrapperContract = getContract(wrapperAddress, WRAPPER_CONTRACT.abi, library, address);

    await this.setState({
      library,
      chainId: network.chainId,
      address,
      connected: true,
      bookLibraryContract,
      tokenAddress,
      tokenContract,
      wrapperAddress,
      wrapperContract
      // userBalance: balanceTry
    });

    await this.getAvailableBooks();
    await this.getBorrowedBooks();
    await this.getUserBalance();
    await this.getContractBalance();

    await this.getRentPrice();
    await this.subscribeToProviderEvents(this.provider);

  };

  public subscribeToProviderEvents = async (provider: any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);
    // this.state.bookLibraryContract.on("NewBookAdded", this.getAvailableBooks);
    this.state.bookLibraryContract.on("NewBookAdded", this.handeBookAdded);
    this.state.bookLibraryContract.on("BookReturned", this.handeBookReturned);
    this.state.bookLibraryContract.on("BookBorrowed", this.handeBookBorrowed);
    
    const filterTransfer = this.state.tokenContract.filters.Transfer(
      null, BOOK_LIBRARY_ADDRESS, null
    );

    this.state.tokenContract.on(filterTransfer, async (from: any, to: any, amount: any, event: any) => {
      const getEventBlock = await event.getBlock();
      showNotification(getEventBlock.hash);
    })

    // the following events are for debuging purpose
    this.state.bookLibraryContract.on("UnwrapInBookContract", (amount: any) => {logMsg(ethers.utils.formatEther(amount))});
    this.state.wrapperContract.on("UnwrapInWrapperContract", (amount: any) => {logMsg(ethers.utils.formatEther(amount))});

    await this.web3Modal.off('accountsChanged');
  };

  public handeBookAdded = async () => {
    await this.getAvailableBooks();
    showNotification('Book added')
  }

  public handeBookBorrowed = async () => {
    await this.getAvailableBooks();
    await this.getBorrowedBooks();
    await this.getUserBalance();
    await this.getContractBalance();
    showNotification('Book borrowed')
  }

  public handeBookReturned = async () => {
    await this.getAvailableBooks();
    showNotification('Book returned')
  }

  public async unSubscribe(provider: any) {
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);

    this.state.bookLibraryContract.off("NewBookAdded", this.handeBookAdded);
    this.state.bookLibraryContract.off("BookReturned", this.handeBookReturned);
    this.state.bookLibraryContract.off("BookBorrowed", this.handeBookBorrowed);

    
  }

  public changedAccount = async (accounts: string[]) => {
    if (!accounts.length) {
      // Metamask Lock fire an empty accounts array 
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
    }
  }

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });
  }

  public close = async () => {
    this.resetApp();
  }

  public getNetwork = () => getChainData(this.state.chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID
        }
      }
    };
    return providerOptions;
  };

  public resetApp = async () => {
    await this.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(this.provider);

    this.setState({ ...INITIAL_STATE });

  };

  public addBook = async (bookTitle: string, quantity: number) => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingAddBook: true });

    try {
      const transaction = await bookLibraryContract.addBook(bookTitle, quantity);

      this.setState({ transactionHash: transaction.hash });

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if(e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingAddBook: false })

    }

  }

  public setErrorMessage = (message: any) => {
    if (message) {

      this.setState({ errorMessage: message, errorFlag: true })
    }
  }

  public clearError = () => {
    this.setState({ errorFlag: false, errorMessage: null })
  }

  public getBookIds = async () => {
    const { bookLibraryContract } = this.state;

    const bookKeysLength = await bookLibraryContract.getCount();

    const bookIds: string[] = [];

    for (let bookIndex = 0; bookIndex < bookKeysLength.toNumber(); bookIndex++) {
      const currentBookKey = await bookLibraryContract.bookKeys(bookIndex);
      bookIds.push(currentBookKey);
    }

    return bookIds;
  }

  public getAvailableBooks = async () => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingBooksList: true });

    const bookKeysArr = await this.getBookIds();
    const availableBooks: object[] = [];

    for (let bookIndex = 0; bookIndex < bookKeysArr.length; bookIndex++) {
      const currentBookKey = bookKeysArr[bookIndex];
      const currentBook = await bookLibraryContract.books(currentBookKey);
      availableBooks.push(currentBook)
    }

    this.setState({ fetchingBooksList: false, availableBooks });
  }

  public getBorrowedBooks = async () => {
    const { bookLibraryContract, address } = this.state;

    this.setState({ fetchingBorrowedBooksList: true });

    const bookKeysArr = await this.getBookIds();
    const borrowedBooks: object[] = [];

    for (let bookIndex = 0; bookIndex < bookKeysArr.length; bookIndex++) {
      const currentBookKey = bookKeysArr[bookIndex];
      const userBorrowedBook = await bookLibraryContract.userBorrowedBooks(address, currentBookKey);
      if (userBorrowedBook === 1) {
        const currentBook = await bookLibraryContract.books(currentBookKey);
        borrowedBooks.push(currentBook);
      }

    }

    this.setState({ fetchingBorrowedBooksList: false, borrowedBooks });
  }

  public borrowBook = async (bookId: string) => {
    const { bookLibraryContract, tokenContract, rentPrice } = this.state;

    this.setState({ fetchingBorrowBook: true });

    try {

      const approveTx = await tokenContract.approve(BOOK_LIBRARY_ADDRESS, rentPrice);
      await approveTx.wait();

      const transaction = await bookLibraryContract.borrowBookById(bookId);

      this.setState({ transactionHash: transaction.hash });

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if(e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingBorrowBook: false })

    }
  }

  public returnBook = async (bookId: string) => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingReturnBook: true });

    try {
      const transaction = await bookLibraryContract.returnBookById(bookId);

      this.setState({ transactionHash: transaction.hash });

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if(e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingReturnBook: false })

    }
  }

  public getUserBalance = async () => {
    const { tokenContract, address } = this.state;

    const userBalance1 = await tokenContract.balanceOf(address);

    const userBalance = ethers.utils.formatEther(userBalance1)

    this.setState({ userBalance });
  }

  public getContractBalance = async () => {

    const { tokenContract, library, wrapperAddress } = this.state;

    const contractBalance1 = await tokenContract.balanceOf(BOOK_LIBRARY_ADDRESS);

    const contractBalance = ethers.utils.formatEther(contractBalance1)

    const contractETHBalance1 = await library.getBalance(wrapperAddress)

    const contractETHBalance = ethers.utils.formatEther(contractETHBalance1)

    this.setState({ contractBalance, contractETHBalance });
  }

  public buyLibTokens = async () => {
    const { wrapperContract } = this.state;

    const wrapValue = ethers.utils.parseEther("0.1");

    const wrapTx = await wrapperContract.wrap({value: wrapValue})
    await wrapTx.wait();

    await this.getUserBalance()
    await this.getContractBalance()
  }

  public unWrapTokenIntoContract = async () => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingunWrapTokens: true });
    try {

      const wrapValue = ethers.utils.parseEther("0.01")

      const transaction = await bookLibraryContract.exchangeTokens(wrapValue);

      this.setState({ transactionHash: transaction.hash });

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }

    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if(e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingunWrapTokens: false })

    }

    await this.getUserBalance();
    await this.getContractBalance();
    
  }



  public getRentPrice = async () => {
    const { bookLibraryContract } = this.state;

    const rentPrice = await bookLibraryContract.rentPrice();

    this.setState({rentPrice})
  }

  public render = () => {
    const {
      address,
      connected,
      chainId,
      fetching,
      fetchingAddBook,
      fetchingBooksList,
      fetchingBorrowBook,
      fetchingBorrowedBooksList,
      fetchingReturnBook,
      transactionHash,
      availableBooks,
      borrowedBooks,
      errorFlag,
      errorMessage
    } = this.state;
    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
          <Header
            connected={connected}
            address={address}
            chainId={chainId}
            killSession={this.resetApp}
          />
          <SContent>
            {fetching ? (
              <Column center>
                <SContainer>
                  <Loader />
                </SContainer>
              </Column>
            ) : (
              <SLanding center>
                {!this.state.connected && <ConnectButton onClick={this.onConnect} />}
                {
                  this.state.connected &&
                  <div>

                    <AddBookForm
                      addBook={this.addBook}
                      transactionHash={transactionHash}
                      fetchingAddBook={fetchingAddBook}
                    />
                    <BooksList
                      itemsList={availableBooks || []}
                      onClick={this.borrowBook}
                      fetchingList={fetchingBooksList}
                      fetchingOnClickAction={fetchingBorrowBook}
                      transactionHash={transactionHash}
                      title={"Books list (click over title if you want to rent certain book)"}
                      showQuantity={true}
                    />
                    <BooksList
                      itemsList={borrowedBooks || []}
                      onClick={this.returnBook}
                      fetchingList={fetchingBorrowedBooksList}
                      fetchingOnClickAction={fetchingReturnBook}
                      transactionHash={transactionHash}
                      title={"Your rented books (click over a title to return the book)"}
                      showQuantity={false}
                    />
                    <div>
                      {this.state.fetchingunWrapTokens ? (
                          <Column center>
                        <SContainer>
                          <Loader />
                        </SContainer>
              </Column>
                      ) : (
                        <div>
                        <span>{`Your current LIBToken balance is: ${this.state.userBalance}`}</span>
                      <button onClick={this.buyLibTokens}>Buy LIBToken</button>
                        </div>

                      )}

                    </div>
                    <div>
                      <span>{`Contract LIBToken balance is: ${this.state.contractBalance}`}</span>
                      <button onClick={this.unWrapTokenIntoContract}>take back your ETH</button>
                    </div>
                    <div>
                      <span>{`Contract ETH balance is: ${this.state.contractETHBalance}`}</span>
                    </div>
                  </div>
                }
                <hr/>
                <ErrorMessage errorFlag={errorFlag} errorMessage={errorMessage} clearError={this.clearError} />
              </SLanding>
            )}
          </SContent>
        </Column>
      </SLayout>
    );
  };
}

export default App;
