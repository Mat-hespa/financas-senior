import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { FinanceService, Transaction, MonthlySummary } from '../../../services/finance.service';

// Register Chart.js components
Chart.register(...registerables);

interface MonthlyData {
  totalIncome: number;
  totalExpenses: number;
  expensesByCategory: { [key: string]: number };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;

  monthlyData: MonthlyData | null = null;
  currentMonthlySummary: MonthlySummary | null = null;
  recentTransactions: Transaction[] = [];
  isLoading = true;
  showAmounts = false;

  private pieChart?: Chart;
  private barChart?: Chart;

  constructor(private financeService: FinanceService) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngAfterViewInit() {
    // Charts will be created after data is loaded
  }

  loadDashboardData() {
    this.isLoading = true;

    // Carregar transações e resumo mensal em paralelo
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    this.financeService.getTransactions().subscribe({
      next: (transactions) => {
        this.processTransactions(transactions);

        // Carregar resumo mensal atual
        this.financeService.getMonthlySummary(currentMonthKey).subscribe({
          next: (summary) => {
            this.currentMonthlySummary = summary;
            this.isLoading = false;

            // Create charts after data is loaded
            setTimeout(() => {
              this.createPieChart();
              this.createBarChart();
            }, 100);
          },
          error: (error) => {
            console.error('Erro ao carregar resumo mensal:', error);
            this.isLoading = false;

            // Create charts mesmo sem resumo
            setTimeout(() => {
              this.createPieChart();
              this.createBarChart();
            }, 100);
          }
        });
      },
      error: (error) => {
        console.error('Erro ao carregar transações:', error);
        this.isLoading = false;
      }
    });
  }

  processTransactions(transactions: Transaction[]) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter current month transactions
    const monthlyTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startOfMonth;
    });

    // Calculate monthly totals
    const totalIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalExpenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Group expenses by category
    const expensesByCategory: { [key: string]: number } = {};
    monthlyTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const category = t.category;
        expensesByCategory[category] = (expensesByCategory[category] || 0) + Math.abs(t.amount);
      });

    this.monthlyData = {
      totalIncome,
      totalExpenses,
      expensesByCategory
    };

    // Get recent transactions (last 5)
    this.recentTransactions = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }

  getBalance(): number {
    if (this.currentMonthlySummary) {
      return this.currentMonthlySummary.summary.balance;
    }
    if (!this.monthlyData) return 0;
    return this.monthlyData.totalIncome - this.monthlyData.totalExpenses;
  }

  getMonthlyBalance(): number {
    return this.getBalance();
  }

  getCurrentMonthIncome(): number {
    if (this.currentMonthlySummary) {
      return this.currentMonthlySummary.summary.totalIncome;
    }
    return this.monthlyData?.totalIncome || 0;
  }

  getCurrentMonthExpenses(): number {
    if (this.currentMonthlySummary) {
      return this.currentMonthlySummary.summary.totalExpenses;
    }
    return this.monthlyData?.totalExpenses || 0;
  }

  getCurrentMonthTransactionCount(): number {
    if (this.currentMonthlySummary) {
      return this.currentMonthlySummary.summary.transactionCount;
    }
    return this.recentTransactions.length;
  }

  initializeMonthlySummaries() {
    this.isLoading = true;

    this.financeService.initializeMonthlySummaries().subscribe({
      next: (result) => {
        console.log('Resumos mensais inicializados:', result);
        this.loadDashboardData();
      },
      error: (error) => {
        console.error('Erro ao inicializar resumos mensais:', error);
        this.isLoading = false;
      }
    });
  }

  getBalanceColor(): string {
    const balance = this.getBalance();
    if (balance > 0) return 'text-green-400';
    if (balance < 0) return 'text-red-400';
    return 'text-gray-400';
  }

  getTransactionIconClass(type: string): string {
    return type === 'income'
      ? 'bg-green-600 text-white'
      : 'bg-red-600 text-white';
  }

  getAmountClass(type: string): string {
    return type === 'income'
      ? 'text-green-400'
      : 'text-red-400';
  }

  hasExpenseData(): boolean {
    return this.monthlyData ? Object.keys(this.monthlyData.expensesByCategory).length > 0 : false;
  }

  hasIncomeOrExpenseData(): boolean {
    const totalIncome = this.getCurrentMonthIncome();
    const totalExpenses = this.getCurrentMonthExpenses();
    return totalIncome > 0 || totalExpenses > 0;
  }

  createPieChart() {
    if (!this.monthlyData || !this.pieChartRef) return;

    const categories = Object.keys(this.monthlyData.expensesByCategory);
    const amounts = Object.values(this.monthlyData.expensesByCategory);

    if (categories.length === 0) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.pieChart) {
      this.pieChart.destroy();
    }

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: amounts,
          backgroundColor: [
            '#ef4444', '#f97316', '#eab308', '#22c55e',
            '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
          ],
          borderWidth: 2,
          borderColor: '#1f2937'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              color: '#d1d5db'
            }
          }
        }
      }
    });
  }

  createBarChart() {
    if (!this.barChartRef) return;

    const totalIncome = this.getCurrentMonthIncome();
    const totalExpenses = this.getCurrentMonthExpenses();

    if (totalIncome === 0 && totalExpenses === 0) return;

    const ctx = this.barChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.barChart) {
      this.barChart.destroy();
    }

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Gastos'],
        datasets: [{
          label: 'Valores (R$)',
          data: [totalIncome, totalExpenses],
          backgroundColor: ['#22c55e', '#ef4444'],
          borderColor: ['#16a34a', '#dc2626'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return 'R$ ' + value.toLocaleString('pt-BR');
              },
              color: '#d1d5db'
            },
            grid: {
              color: '#374151'
            }
          },
          x: {
            ticks: {
              color: '#d1d5db'
            },
            grid: {
              color: '#374151'
            }
          }
        }
      }
    });
  }

  toggleAmountVisibility() {
    this.showAmounts = !this.showAmounts;
  }

  formatAmount(amount: number): string {
    if (!this.showAmounts) {
      return '••••••';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  ngOnDestroy() {
    if (this.pieChart) {
      this.pieChart.destroy();
    }
    if (this.barChart) {
      this.barChart.destroy();
    }
  }
}
