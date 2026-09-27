import type { Account, FinanceState, Transaction } from "./entities";
import { addMoney, moneyFromCents, negateMoney } from "./money";
import type { Money } from "./money";

export type LedgerMetrics = {
  liquidPosition: Money;
  netWorth: Money;
  spending: Money;
  cashFlow: Money;
};

function accountDelta(transaction: Transaction, accountId: string): Money {
  const amount = transaction.amount;
  if (transaction.kind === "income" && transaction.accountId === accountId) return amount;
  if (transaction.kind === "expense" && transaction.accountId === accountId) return negateMoney(amount);
  if (transaction.kind === "debt-payment" && transaction.accountId === accountId) return negateMoney(amount);
  if (transaction.kind === "investment" && transaction.accountId === accountId) return negateMoney(amount);
  if (transaction.kind === "transfer" && transaction.accountId === accountId) return negateMoney(amount);
  if (transaction.kind === "transfer" && transaction.destinationAccountId === accountId) return amount;
  return moneyFromCents(0);
}

export function accountBalance(account: Account, transactions: Transaction[]): Money {
  return addMoney(account.openingBalance, ...transactions.map((transaction) => accountDelta(transaction, account.id)));
}

export function liquidPosition(state: FinanceState): Money {
  return addMoney(
    ...state.accounts
      .filter((account) => !account.archived && (account.kind === "cash" || account.kind === "bank"))
      .map((account) => accountBalance(account, state.transactions)),
  );
}

export function spending(transactions: Transaction[]): Money {
  return addMoney(
    ...transactions
      .filter((transaction) => transaction.kind === "expense")
      .map((transaction) => transaction.amount),
  );
}

export function cashFlow(transactions: Transaction[]): Money {
  return addMoney(
    ...transactions
      .filter((transaction) => transaction.kind === "income")
      .map((transaction) => transaction.amount),
    ...transactions
      .filter((transaction) => transaction.kind === "expense" || transaction.kind === "debt-payment")
      .map((transaction) => negateMoney(transaction.amount)),
  );
}

export function liabilities(state: FinanceState): Money {
  return addMoney(
    ...state.accounts
      .filter((account) => !account.archived && account.kind === "credit")
      .map((account) => negateMoney(accountBalance(account, state.transactions))),
  );
}

export function netWorth(state: FinanceState): Money {
  return addMoney(liquidPosition(state), liabilities(state));
}

export function deriveMetrics(state: FinanceState): LedgerMetrics {
  return {
    liquidPosition: liquidPosition(state),
    netWorth: netWorth(state),
    spending: spending(state.transactions),
    cashFlow: cashFlow(state.transactions),
  };
}
