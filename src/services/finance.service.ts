import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay, map, catchError, throwError, timeout } from 'rxjs';

export interface Transaction {
  _id?: string;
  id?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Date;
  userId?: string;
  created: Date;
  updatedAt?: Date;
}

export interface MonthlySummary {
  _id?: string;
  month: string; // 'YYYY-MM'
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactionCount: number;
  };
  transactions: string[]; // Array of ObjectIds
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
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

export interface MonthlyStats {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expensesByCategory: { [key: string]: number };
}

export interface MonthData {
  monthYear: string;
  year: number;
  month: number;
  count: number;
  minDate: Date;
  maxDate: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    current: number;
    pages: number;
    total: number;
    limit: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private baseUrl = 'https://servidor-financas.onrender.com/api/transactions';
  private summaryUrl = 'https://servidor-financas.onrender.com/api/transactions/summaries';
  private readonly API_TIMEOUT = 25000; // 25 segundos para aguardar servidor acordar

  constructor(private http: HttpClient) {}



  private handleError<T>(operation = 'operation') {
    return (error: any): Observable<T> => {
      console.error(`❌ ${operation} falhou:`, error);

      // Não usar localStorage como fallback - sempre lançar erro
      return throwError(() => error);
    };
  }

  private normalizeTransaction(transaction: any): Transaction {
    return {
      ...transaction,
      id: transaction._id || transaction.id,
      date: new Date(transaction.date),
      createdAt: transaction.createdAt ? new Date(transaction.createdAt) : undefined,
      updatedAt: transaction.updatedAt ? new Date(transaction.updatedAt) : undefined
    };
  }

  // Métodos principais da API
  getTransactions(params?: {
    month?: number;
    year?: number;
    type?: 'income' | 'expense';
    category?: string;
    page?: number;
    limit?: number;
  }): Observable<Transaction[]> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.month) httpParams = httpParams.set('month', params.month.toString());
      if (params.year) httpParams = httpParams.set('year', params.year.toString());
      if (params.type) httpParams = httpParams.set('type', params.type);
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    }

    return this.http.get<ApiResponse<Transaction[]>>(this.baseUrl, { params: httpParams })
      .pipe(
        timeout(this.API_TIMEOUT),
        map(response => response.data.map(t => this.normalizeTransaction(t))),
        catchError(this.handleError<Transaction[]>('getTransactions'))
      );
  }



  addTransaction(transaction: Omit<Transaction, 'id' | '_id'>): Observable<Transaction> {
    // Adicionar userId padrão se não especificado
    const transactionWithUser = {
      ...transaction,
      userId: transaction.userId || 'default-user'
    };

    return this.http.post<ApiResponse<Transaction>>(this.baseUrl, transactionWithUser)
      .pipe(
        timeout(this.API_TIMEOUT),
        map(response => this.normalizeTransaction(response.data)),
        catchError(this.handleError<Transaction>('addTransaction'))
      );
  }

  updateTransaction(id: string, updatedTransaction: Partial<Transaction>): Observable<Transaction> {
    return this.http.put<ApiResponse<Transaction>>(`${this.baseUrl}/${id}`, updatedTransaction)
      .pipe(
        timeout(this.API_TIMEOUT),
        map(response => this.normalizeTransaction(response.data)),
        catchError(this.handleError<Transaction>('updateTransaction'))
      );
  }

  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`)
      .pipe(
        timeout(this.API_TIMEOUT),
        map(() => void 0),
        catchError(this.handleError<void>('deleteTransaction'))
      );
  }

  // Obter estatísticas mensais
  getMonthlyStats(year?: number, month?: number): Observable<MonthlyStats> {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);
    const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    return this.getMonthlySummary(monthKey).pipe(
      timeout(this.API_TIMEOUT),
      map(summary => {
        if (summary) {
          return this.convertMonthlySummaryToStats(summary, monthKey);
        } else {
          // Se não há resumo, retornar dados zerados
          return this.createEmptyMonthlyStats(monthKey);
        }
      }),
      catchError(this.handleError<MonthlyStats>('getMonthlyStats'))
    );
  }

  private convertMonthlySummaryToStats(summary: MonthlySummary, monthKey: string): MonthlyStats {
    // Para expensesByCategory, buscar dados das transações do mês via API
    const [year, month] = monthKey.split('-').map(Number);

    return {
      month: summary.month,
      totalIncome: summary.summary.totalIncome,
      totalExpenses: summary.summary.totalExpenses,
      balance: summary.summary.balance,
      expensesByCategory: {} // Será preenchido pela API se necessário
    };
  }

  private createEmptyMonthlyStats(monthKey: string): MonthlyStats {
    return {
      month: monthKey,
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      expensesByCategory: {}
    };
  }

  // Obter meses disponíveis
  getAvailableMonths(): Observable<MonthData[]> {
    return this.http.get<ApiResponse<MonthData[]>>(`${this.baseUrl}/months`)
      .pipe(
        timeout(this.API_TIMEOUT),
        map(response => response.data.map(month => ({
          ...month,
          minDate: new Date(month.minDate),
          maxDate: new Date(month.maxDate)
        }))),
        catchError(this.handleError<MonthData[]>('getAvailableMonths'))
      );
  }



  // Método para compatibilidade com o código existente
  getMonthlyData(): Observable<any> {
    return this.getMonthlyStats().pipe(
      map(stats => ({
        totalIncome: stats.totalIncome,
        totalExpenses: stats.totalExpenses,
        expensesByCategory: stats.expensesByCategory
      }))
    );
  }

  // Métodos para resumos mensais automáticos
  private updateMonthlySummaryAfterTransaction(transaction: Transaction): Observable<any> {
    // O backend já atualiza automaticamente quando uma transação é criada
    // Este método é mantido por compatibilidade mas não precisa fazer chamada adicional
    return of({ success: true }).pipe(delay(100));
  }



  // Obter resumo mensal específico
  getMonthlySummary(monthKey: string): Observable<MonthlySummary | null> {
    const [year, month] = monthKey.split('-');
    return this.http.get<ApiResponse<MonthlySummary>>(`${this.summaryUrl}/${year}/${month}`)
      .pipe(
        timeout(this.API_TIMEOUT),
        map(response => response.data),
        catchError(this.handleError<MonthlySummary | null>('getMonthlySummary'))
      );
  }

  // Obter todos os resumos mensais
  getAllMonthlySummaries(): Observable<MonthlySummary[]> {
    return this.http.get<ApiResponse<MonthlySummary[]>>(`${this.summaryUrl}`)
      .pipe(
        timeout(this.API_TIMEOUT),
        map(response => response.data),
        catchError(this.handleError<MonthlySummary[]>('getAllMonthlySummaries'))
      );
  }

  // Inicializar resumos mensais para transações existentes
  initializeMonthlySummaries(): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.summaryUrl}/recalculate`, {
      userId: 'default-user'
    }).pipe(
      timeout(this.API_TIMEOUT),
      map(response => response.data),
      catchError(this.handleError<any>('initializeMonthlySummaries'))
    );
  }
}
