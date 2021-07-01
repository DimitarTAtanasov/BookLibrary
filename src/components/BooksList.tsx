import * as React from 'react';
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

interface ITBooksListProps {
  itemsList: object;
  onClick: any,
  fetchingList: boolean,
  fetchingOnClickAction: boolean,
  transactionHash: string,
  title: string,
  showQuantity: boolean
}

function BooksList(prop: ITBooksListProps) {
  const { itemsList, fetchingList, fetchingOnClickAction, transactionHash, title,showQuantity } = prop;

  return (

    <div>
      <h5>{title}</h5>
      {
        fetchingList ? (
          <Column center>
            <SContainer>
              <Loader />    
            </SContainer>
          </Column>
        ) : (
          fetchingOnClickAction ? (
            <Column center>
              <SContainer>
                <Loader />
                <TransactionDetails transactionHash={transactionHash} />
              </SContainer>
            </Column>
          ) : (
            <ul>
              {
                Object.keys(itemsList).length
                  ? Object.keys(itemsList).map((key: any) => <li key={key} onClick={() => { prop.onClick(key) }}><span>{itemsList[key].bookName}</span> {showQuantity && <span>{`Quantity: ${itemsList[key].numberOfCopies}`}</span>}</li>)
                  : <li>No items in this list</li>
              }
            </ul>
          )
        )
      }
    </div>
  )
}

export default BooksList;