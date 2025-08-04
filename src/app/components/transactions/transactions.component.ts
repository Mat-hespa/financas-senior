import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { FinanceService, Transaction } from '../../../services/finance.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './transactions.component.html'
})
export class TransactionsComponent implements OnInit {
  allTransactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  isLoading = true;

  // Filter properties
  searchTerm = '';
  selectedType = '';
  selectedCategory = '';
  selectedPeriod = '';

  // Categories for filter dropdown
  allCategories: string[] = [];

  constructor(
    private financeService: FinanceService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions() {
    this.isLoading = true;
    this.financeService.getTransactions().subscribe({
      next: (transactions) => {
        this.allTransactions = transactions.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        this.filteredTransactions = [...this.allTransactions];
        this.extractCategories();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar transações:', error);
        this.isLoading = false;
      }
    });
  }

  extractCategories() {
    const categories = [...new Set(this.allTransactions.map(t => t.category))];
    this.allCategories = categories.sort();
  }

  applyFilters() {
    let filtered = [...this.allTransactions];

    if (this.searchTerm.trim()) {
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    if (this.selectedType) {
      filtered = filtered.filter(t => t.type === this.selectedType);
    }

    if (this.selectedCategory) {
      filtered = filtered.filter(t => t.category === this.selectedCategory);
    }

    if (this.selectedPeriod) {
      const now = new Date();
      let startDate: Date;

      switch (this.selectedPeriod) {
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          filtered = filtered.filter(t => new Date(t.date) >= startDate);
          break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          filtered = filtered.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= startDate && transactionDate <= endDate;
          });
          break;
        case 'last3Months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          filtered = filtered.filter(t => new Date(t.date) >= startDate);
          break;
      }
    }

    this.filteredTransactions = filtered;
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedCategory = '';
    this.selectedPeriod = '';
    this.filteredTransactions = [...this.allTransactions];
  }

  // Updated for dark theme
  getTransactionIconClass(type: string): string {
    return type === 'income'
      ? 'bg-green-600 text-white'
      : 'bg-red-600 text-white';
  }

  // Updated for dark theme
  getAmountClass(type: string): string {
    return type === 'income'
      ? 'text-green-400'
      : 'text-red-400';
  }

  editTransaction(transaction: Transaction) {
    this.router.navigate(['/edit-transaction', transaction.id]);
  }

  deleteTransaction(id: string) {
    Swal.fire({
      title: 'Excluir transação?',
      text: 'Esta ação não pode ser desfeita!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar',
      background: '#1f2937',
      color: '#ffffff'
    }).then((result) => {
      if (result.isConfirmed) {
        this.financeService.deleteTransaction(id).subscribe({
          next: () => {
            Swal.fire({
              title: 'Excluída!',
              text: 'A transação foi excluída com sucesso.',
              icon: 'success',
              background: '#1f2937',
              color: '#ffffff',
              confirmButtonColor: '#10b981'
            });
            this.loadTransactions();
          },
          error: (error) => {
            console.error('Erro ao excluir transação:', error);
            Swal.fire({
              title: 'Erro!',
              text: 'Não foi possível excluir a transação.',
              icon: 'error',
              background: '#1f2937',
              color: '#ffffff',
              confirmButtonColor: '#ef4444'
            });
          }
        });
      }
    });
  }

  getTotalIncome(): number {
    return this.filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  getTotalExpenses(): number {
    return this.filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  getNetBalance(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }

  // Updated for dark theme
  getNetBalanceClass(): string {
    const balance = this.getNetBalance();
    if (balance > 0) return 'text-green-400';
    if (balance < 0) return 'text-red-400';
    return 'text-gray-400';
  }

  // Additional utility methods for better UX
  refreshTransactions() {
    this.loadTransactions();
  }

  // Enhanced search that includes category
  onSearchChange() {
    this.applyFilters();
  }

  // Export filtered transactions
  exportTransactions() {
    const data = this.filteredTransactions.map(t => ({
      Data: new Date(t.date).toLocaleDateString('pt-BR'),
      Descrição: t.description,
      Categoria: t.category,
      Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      Valor: t.amount
    }));

    const csv = this.convertToCSV(data);
    this.downloadCSV(csv, 'transacoes.csv');
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  private downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}