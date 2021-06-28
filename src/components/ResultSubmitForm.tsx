import * as React from 'react';
import './form.css'
import { logMsg } from '../helpers/dev';
import Column from './Column';
import Loader from './Loader';
import TransactionDetails from './TransactionDetails';
import styled from 'styled-components';

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

interface IAppState {
  bookTitle: string;
  quantity: number;
  fetchingAddBook: boolean;
  transactionHash: string
}

const INITIAL_STATE: IAppState = {
  bookTitle: '',
  quantity: 0,
  fetchingAddBook: false,
  transactionHash: ''
};

class AddBookForm extends React.Component<any, any> {
  // @ts-ignore
  public state: IAppState;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  public handleSubmit(event: any) {
    const {
      bookTitle,
      quantity
    } = this.state;

    logMsg('form submitted')
    event.preventDefault();
    this.props.addBook(bookTitle, quantity)
  }

  public handleChange(event: any) {
    const nam = event.target.name;
    const val = event.target.value;
    this.setState({ [nam]: val });
  }


  public render = () => {
    const { bookTitle, quantity } = this.state
    const { fetchingAddBook, transactionHash } = this.props;
    return (
      <div>
          {
          fetchingAddBook ? (
            <Column center>
              <SContainer>
                <Loader />
                <TransactionDetails transactionHash={transactionHash} />
              </SContainer>
            </Column>
          ) : (
            <form onSubmit={this.handleSubmit}>
              <label>
                Book title:
                <input className={'formInput'} type="text" name="bookTitle" value={bookTitle} onChange={this.handleChange} />
              </label>
              <label>
                Quantity:
                <input className={'formInput'} type="number" name="quantity" value={quantity} onChange={this.handleChange} />
              </label>
              <input type="submit" value="Submit" />
            </form>
          )
        }
      </div>


    );
  };
}

// some code changes

export default AddBookForm;
