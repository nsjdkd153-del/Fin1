export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'expense' | 'return' | 'investment';
}

export type CategoryType = string;

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  allocatedBudget: number;
  transactions: Transaction[];
}

export interface Income {
  id: string;
  date: string;
  source: string;
  amount: number;
}

export interface FinanceData {
  baseCapital: number;
  incomes: Income[];
  categories: Category[];
}
