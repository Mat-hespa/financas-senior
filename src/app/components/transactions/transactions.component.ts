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

  exportCurrentMonth(format: 'json' | 'csv' | 'pdf') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get current month transactions
    this.financeService.getTransactions().subscribe({
      next: (allTransactions) => {
        const currentMonthTransactions = allTransactions.filter(t => {
          const transactionDate = new Date(t.date);
          return transactionDate >= startOfMonth;
        });

        if (currentMonthTransactions.length === 0) {
          Swal.fire({
            title: 'Nenhuma transação',
            text: 'Não há transações para exportar no mês atual.',
            icon: 'info',
            background: '#1f2937',
            color: '#ffffff',
            confirmButtonColor: '#6b7280'
          });
          return;
        }

        const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        switch (format) {
          case 'json':
            this.exportAsJSON(currentMonthTransactions, monthKey);
            break;
          case 'csv':
            this.exportAsCSVWithEncoding(currentMonthTransactions, monthKey);
            break;
          case 'pdf':
            this.exportAsPDF(currentMonthTransactions, monthKey);
            break;
        }
      },
      error: (error) => {
        console.error('Erro ao exportar:', error);
      }
    });
  }

  private exportAsJSON(transactions: Transaction[], monthKey: string) {
    const data = {
      month: monthKey,
      summary: {
        totalIncome: this.getTotalIncome(),
        totalExpenses: this.getTotalExpenses(),
        balance: this.getNetBalance(),
        transactionCount: transactions.length
      },
      transactions: transactions
    };

    const jsonString = JSON.stringify(data, null, 2);
    this.downloadFile(jsonString, `transacoes-${monthKey}.json`, 'application/json');
  }

  private exportAsCSVWithEncoding(transactions: Transaction[], monthKey: string) {
    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = '\uFEFF';

    const csvData = transactions.map(t => ({
      Data: new Date(t.date).toLocaleDateString('pt-BR'),
      Descricao: t.description,
      Categoria: t.category,
      Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      Valor: t.amount.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).replace('R$', '').trim()
    }));

    const headers = ['Data', 'Descricao', 'Categoria', 'Tipo', 'Valor'];
    const csvContent = BOM + [
      headers.join(';'), // Using semicolon for better Excel compatibility
      ...csvData.map(row =>
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape quotes and wrap in quotes if contains special characters
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(';')
      )
    ].join('\n');

    this.downloadFile(csvContent, `transacoes-${monthKey}.csv`, 'text/csv;charset=utf-8');
  }

  private exportAsPDF(transactions: Transaction[], monthKey: string) {
    const content = this.generatePDFContent(transactions, monthKey);
    this.downloadFile(content, `relatorio-${monthKey}.txt`, 'text/plain;charset=utf-8');
  }

  private generatePDFContent(transactions: Transaction[], monthKey: string): string {
    const month = monthKey.split('-')[1];
    const year = monthKey.split('-')[0];
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let content = `RELATÓRIO FINANCEIRO - ${monthNames[parseInt(month) - 1]} ${year}\n`;
    content += '='.repeat(60) + '\n\n';

    content += `Total de Receitas: ${this.getTotalIncome().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    content += `Total de Despesas: ${this.getTotalExpenses().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    content += `Saldo Final: ${this.getNetBalance().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    content += `Total de Transações: ${transactions.length}\n\n`;

    content += 'DETALHAMENTO DAS TRANSAÇÕES:\n';
    content += '-'.repeat(60) + '\n';

    transactions.forEach(t => {
      content += `${new Date(t.date).toLocaleDateString('pt-BR')} | `;
      content += `${t.type === 'income' ? 'RECEITA' : 'DESPESA'} | `;
      content += `${t.category} | `;
      content += `${t.description} | `;
      content += `${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    });

    return content;
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

  resetCurrentMonth() {
    Swal.fire({
      title: 'Resetar mês atual?',
      text: 'Esta ação irá excluir TODAS as transações do mês atual. Esta ação não pode ser desfeita!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, resetar!',
      cancelButtonText: 'Cancelar',
      background: '#1f2937',
      color: '#ffffff'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performReset();
      }
    });
  }

  private performReset() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    this.financeService.getTransactions().subscribe({
      next: (allTransactions) => {
        const currentMonthTransactions = allTransactions.filter(t => {
          const transactionDate = new Date(t.date);
          return transactionDate >= startOfMonth;
        });

        if (currentMonthTransactions.length === 0) {
          Swal.fire({
            title: 'Nada para resetar',
            text: 'Não há transações no mês atual para excluir.',
            icon: 'info',
            background: '#1f2937',
            color: '#ffffff',
            confirmButtonColor: '#6b7280'
          });
          return;
        }

        // Delete each transaction
        const deletePromises = currentMonthTransactions.map(t =>
          this.financeService.deleteTransaction(t.id).toPromise()
        );

        Promise.all(deletePromises).then(() => {
          Swal.fire({
            title: 'Resetado!',
            text: `${currentMonthTransactions.length} transação(ões) foram excluídas.`,
            icon: 'success',
            background: '#1f2937',
            color: '#ffffff',
            confirmButtonColor: '#10b981'
          });
          this.loadTransactions(); // Reload data
        }).catch((error) => {
          console.error('Erro ao resetar:', error);
          Swal.fire({
            title: 'Erro!',
            text: 'Não foi possível resetar o mês.',
            icon: 'error',
            background: '#1f2937',
            color: '#ffffff',
            confirmButtonColor: '#ef4444'
          });
        });
      }
    });
  }
}