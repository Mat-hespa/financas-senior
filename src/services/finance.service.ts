import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Date;
}

export interface MonthlyArchive {
  month: string; // 'YYYY-MM'
  transactions: Transaction[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
  };
  archivedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private baseUrl = 'http://localhost:3000';
  private storageKey = 'finance-transactions';
  private archiveKey = 'finance-monthly-archives';

  constructor(private http: HttpClient) {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
      // Initialize empty array instead of mock data
      localStorage.setItem(this.storageKey, JSON.stringify([]));
    }
  }

  private saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(transactions));
  }

  private getStoredTransactions(): Transaction[] {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return [];

    return JSON.parse(stored).map((t: any) => ({
      ...t,
      date: new Date(t.date)
    }));
  }

  getTransactions(): Observable<Transaction[]> {
    const transactions = this.getStoredTransactions();
    return of(transactions).pipe(delay(300));
  }

  addTransaction(transaction: Omit<Transaction, 'id'>): Observable<Transaction> {
    const transactions = this.getStoredTransactions();
    const newTransaction = {
      ...transaction,
      id: Date.now().toString(),
      date: new Date(transaction.date)
    };

    transactions.push(newTransaction);
    this.saveTransactions(transactions);

    return of(newTransaction).pipe(delay(200));
  }

  updateTransaction(id: string, updatedTransaction: Partial<Transaction>): Observable<Transaction> {
    const transactions = this.getStoredTransactions();
    const index = transactions.findIndex(t => t.id === id);

    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updatedTransaction };
      this.saveTransactions(transactions);
      return of(transactions[index]).pipe(delay(200));
    }

    throw new Error('Transaction not found');
  }

  deleteTransaction(id: string): Observable<void> {
    const transactions = this.getStoredTransactions();
    const filteredTransactions = transactions.filter(t => t.id !== id);
    this.saveTransactions(filteredTransactions);
    return of(void 0).pipe(delay(200));
  }

  // Monthly Archive Functions
  archiveCurrentMonth(): Observable<MonthlyArchive> {
    const transactions = this.getStoredTransactions();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get current month transactions
    const monthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      return transactionMonth === currentMonth;
    });

    // Calculate summary
    const totalIncome = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalExpenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const archive: MonthlyArchive = {
      month: currentMonth,
      transactions: monthTransactions,
      summary: {
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses
      },
      archivedAt: new Date()
    };

    // Save to archives
    this.saveArchive(archive);

    // Remove archived transactions from current storage
    const remainingTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      return transactionMonth !== currentMonth;
    });

    this.saveTransactions(remainingTransactions);

    return of(archive).pipe(delay(300));
  }

  private saveArchive(archive: MonthlyArchive): void {
    const archives = this.getStoredArchives();
    archives.push(archive);
    localStorage.setItem(this.archiveKey, JSON.stringify(archives));
  }

  private getStoredArchives(): MonthlyArchive[] {
    const stored = localStorage.getItem(this.archiveKey);
    if (!stored) return [];

    return JSON.parse(stored).map((a: any) => ({
      ...a,
      archivedAt: new Date(a.archivedAt),
      transactions: a.transactions.map((t: any) => ({
        ...t,
        date: new Date(t.date)
      }))
    }));
  }

  getMonthlyArchives(): Observable<MonthlyArchive[]> {
    const archives = this.getStoredArchives();
    return of(archives).pipe(delay(200));
  }

  exportArchiveAsJSON(monthKey: string): Observable<string> {
    const archives = this.getStoredArchives();
    const archive = archives.find(a => a.month === monthKey);

    if (!archive) {
      throw new Error('Archive not found');
    }

    const exportData = {
      ...archive,
      exportedAt: new Date(),
      format: 'JSON'
    };

    return of(JSON.stringify(exportData, null, 2)).pipe(delay(100));
  }

  exportArchiveAsCSV(monthKey: string): Observable<string> {
    const archives = this.getStoredArchives();
    const archive = archives.find(a => a.month === monthKey);

    if (!archive) {
      throw new Error('Archive not found');
    }

    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'];
    const rows = archive.transactions.map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.description,
      t.category,
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.amount.toString()
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return of(csvContent).pipe(delay(100));
  }

  // Helper method to check if current month should be archived
  shouldPromptForArchive(): boolean {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastArchiveCheck = localStorage.getItem('last-archive-check');

    if (lastArchiveCheck !== currentMonth) {
      localStorage.setItem('last-archive-check', currentMonth);

      // Check if previous month has transactions that aren't archived
      const transactions = this.getStoredTransactions();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

      const hasUnArchivedPreviousMonth = transactions.some(t => {
        const transactionDate = new Date(t.date);
        const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
        return transactionMonth === previousMonthKey;
      });

      return hasUnArchivedPreviousMonth;
    }

    return false;
  }

  getMonthlyData(): Observable<any> {
    const transactions = this.getStoredTransactions();
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, curr) => {
        const category = curr.category;
        acc[category] = (acc[category] || 0) + Math.abs(curr.amount);
        return acc;
      }, {} as any);

    const monthlyData = {
      totalIncome: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalExpenses: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0),
      expensesByCategory: expenses
    };

    return of(monthlyData).pipe(delay(300));
  }

  // Clear all data (for testing purposes)
  clearAllData(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.archiveKey);
    localStorage.removeItem('last-archive-check');
  }
}