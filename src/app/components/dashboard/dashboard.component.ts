import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { FinanceService, MonthlyArchive, Transaction } from '../../../services/finance.service';

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
  recentTransactions: Transaction[] = [];
  isLoading = true;
  showArchivePrompt = false;
  monthlyArchives: MonthlyArchive[] = [];

  private pieChart?: Chart;
  private barChart?: Chart;

  constructor(private financeService: FinanceService) {}

  ngOnInit() {
    this.checkForArchivePrompt();
    this.loadDashboardData();
    this.loadArchives();
  }

  ngAfterViewInit() {
    // Charts will be created after data is loaded
  }

  checkForArchivePrompt() {
    this.showArchivePrompt = this.financeService.shouldPromptForArchive();
  }

  loadDashboardData() {
    this.isLoading = true;

    this.financeService.getTransactions().subscribe({
      next: (transactions) => {
        this.processTransactions(transactions);
        this.isLoading = false;

        // Create charts after data is loaded
        setTimeout(() => {
          this.createPieChart();
          this.createBarChart();
        }, 100);
      },
      error: (error) => {
        console.error('Erro ao carregar transações:', error);
        this.isLoading = false;
      }
    });
  }

  loadArchives() {
    this.financeService.getMonthlyArchives().subscribe({
      next: (archives) => {
        this.monthlyArchives = archives;
      },
      error: (error) => {
        console.error('Erro ao carregar arquivos:', error);
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

  // Archive Management Methods
  archiveCurrentMonth() {
    this.isLoading = true;
    this.financeService.archiveCurrentMonth().subscribe({
      next: (archive) => {
        console.log('Mês arquivado:', archive);
        this.showArchivePrompt = false;
        this.loadDashboardData(); // Reload data
        this.loadArchives(); // Reload archives
      },
      error: (error) => {
        console.error('Erro ao arquivar mês:', error);
        this.isLoading = false;
      }
    });
  }

  dismissArchivePrompt() {
    this.showArchivePrompt = false;
  }

  exportArchive(monthKey: string, format: 'json' | 'csv') {
    const exportMethod = format === 'json'
      ? this.financeService.exportArchiveAsJSON(monthKey)
      : this.financeService.exportArchiveAsCSV(monthKey);

    exportMethod.subscribe({
      next: (data) => {
        this.downloadFile(data, `financeiro-${monthKey}.${format}`,
          format === 'json' ? 'application/json' : 'text/csv');
      },
      error: (error) => {
        console.error('Erro ao exportar:', error);
      }
    });
  }

  private downloadFile(data: string, filename: string, type: string) {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  getMonthlyBalance(): number {
    if (!this.monthlyData) return 0;
    return this.monthlyData.totalIncome - this.monthlyData.totalExpenses;
  }

  getBalance(): number {
    if (!this.monthlyData) return 0;
    return this.monthlyData.totalIncome - this.monthlyData.totalExpenses;
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

  createPieChart() {
    if (!this.monthlyData || !this.pieChartRef) return;

    const categories = Object.keys(this.monthlyData.expensesByCategory);
    const amounts = Object.values(this.monthlyData.expensesByCategory);

    if (categories.length === 0) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
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
    if (!this.monthlyData || !this.barChartRef) return;

    const ctx = this.barChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.barChart) {
      this.barChart.destroy();
    }

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Gastos'],
        datasets: [{
          label: 'Valores (R$)',
          data: [this.monthlyData.totalIncome, this.monthlyData.totalExpenses],
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

  ngOnDestroy() {
    // Cleanup charts
    if (this.pieChart) {
      this.pieChart.destroy();
    }
    if (this.barChart) {
      this.barChart.destroy();
    }
  }
}