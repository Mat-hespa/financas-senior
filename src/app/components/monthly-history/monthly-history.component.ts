import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { FinanceService, MonthData, MonthlyStats, Transaction } from '../../../services/finance.service';

Chart.register(...registerables);

@Component({
  selector: 'app-monthly-history',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-900 pb-6">
      <!-- Header -->
      <div class="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 z-10">
        <div class="px-4 py-4">
          <h1 class="text-xl font-bold text-white">Histórico Mensal</h1>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="isLoading" class="px-4 mt-6">
        <div class="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 p-8 text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p class="mt-4 text-gray-400">Carregando dados...</p>
        </div>
      </div>

      <!-- Content -->
      <div *ngIf="!isLoading" class="px-4 space-y-6 mt-6">

        <!-- Seleção de Mês -->
        <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4" *ngIf="availableMonths.length > 0 && !isLoading">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-medium text-white text-sm">Período</h3>
          </div>

          <select
            [(ngModel)]="selectedMonth"
            (ngModelChange)="onMonthSelect($event)"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          >
            <option [ngValue]="null">Selecione um mês</option>
            <option *ngFor="let month of availableMonths" [ngValue]="month">
              {{ formatMonthYear(month.monthYear) }}
            </option>
          </select>
        </div>

        <!-- Loading específico para dados do mês -->
        <div *ngIf="shouldShowTransitionLoading()" class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
          <p class="mt-3 text-gray-400 text-sm">Carregando dados do mês...</p>
        </div>

        <!-- Resumo Financeiro -->
        <div *ngIf="selectedMonthStats && shouldShowContent()" class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-5">
          <h3 class="font-medium text-white mb-4 text-sm">Resumo do Mês</h3>

          <div class="grid grid-cols-1 gap-4">
            <!-- Receitas e Despesas -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gray-700/50 rounded-lg p-4 text-center">
                <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"></path>
                  </svg>
                </div>
                <p class="text-xs text-gray-400 mb-1">Receitas</p>
                <p class="text-lg font-bold text-green-400">{{ formatCurrency(selectedMonthStats.totalIncome) }}</p>
              </div>

              <div class="bg-gray-700/50 rounded-lg p-4 text-center">
                <div class="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"></path>
                  </svg>
                </div>
                <p class="text-xs text-gray-400 mb-1">Despesas</p>
                <p class="text-lg font-bold text-red-400">{{ formatCurrency(selectedMonthStats.totalExpenses) }}</p>
              </div>
            </div>

            <!-- Saldo Final -->
            <div class="bg-gray-700/30 rounded-lg p-4 text-center border border-gray-600">
              <div class="flex items-center justify-center mb-2">
                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2"></path>
                  </svg>
                </div>
              </div>
              <p class="text-sm text-gray-400 mb-1">Saldo do Mês</p>
              <p class="text-xl font-bold" [ngClass]="selectedMonthStats.balance >= 0 ? 'text-green-400' : 'text-red-400'">
                {{ formatCurrency(selectedMonthStats.balance) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Análise por Categorias -->
        <div *ngIf="shouldShowContent()" class="space-y-4">
          <!-- Despesas por Categoria -->
          <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-5">
            <h3 class="font-medium text-white mb-4 text-sm">Despesas por Categoria</h3>

            <div class="space-y-3" *ngIf="getExpensesByCategory().length > 0; else noExpenses">
              <div *ngFor="let category of getExpensesByCategory()"
                   class="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                      <span class="text-lg">{{ getCategoryIcon(category.name) }}</span>
                    </div>
                    <div>
                      <h4 class="text-sm font-medium text-white">{{ category.name }}</h4>
                      <p class="text-xs text-gray-400">{{ category.count }} transação{{ category.count !== 1 ? 'ões' : '' }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-red-400 font-bold text-sm">
                      {{ formatCurrency(category.total) }}
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ category.percentage }}% do total
                    </div>
                  </div>
                </div>
                <div class="w-full bg-gray-600 rounded-full h-2">
                  <div class="bg-red-500 h-2 rounded-full transition-all duration-500"
                       [style.width.%]="category.percentage">
                  </div>
                </div>
              </div>
            </div>

            <ng-template #noExpenses>
              <div class="text-center py-8 text-gray-400">
                <div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"></path>
                  </svg>
                </div>
                <p class="text-sm">Nenhuma despesa registrada</p>
              </div>
            </ng-template>
          </div>

          <!-- Receitas por Categoria -->
          <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-5">
            <h3 class="font-medium text-white mb-4 text-sm">Receitas por Categoria</h3>

            <div class="space-y-3" *ngIf="getIncomesByCategory().length > 0; else noIncomes">
              <div *ngFor="let category of getIncomesByCategory()"
                   class="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                      <span class="text-lg">{{ getCategoryIcon(category.name) }}</span>
                    </div>
                    <div>
                      <h4 class="text-sm font-medium text-white">{{ category.name }}</h4>
                      <p class="text-xs text-gray-400">{{ category.count }} transação{{ category.count !== 1 ? 'ões' : '' }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-green-400 font-bold text-sm">
                      {{ formatCurrency(category.total) }}
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ category.percentage }}% do total
                    </div>
                  </div>
                </div>
                <div class="w-full bg-gray-600 rounded-full h-2">
                  <div class="bg-green-500 h-2 rounded-full transition-all duration-500"
                       [style.width.%]="category.percentage">
                  </div>
                </div>
              </div>
            </div>

            <ng-template #noIncomes>
              <div class="text-center py-8 text-gray-400">
                <div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"></path>
                  </svg>
                </div>
                <p class="text-sm">Nenhuma receita registrada</p>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Insights e Estatísticas -->
        <div *ngIf="shouldShowContent()" class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-5">
          <h3 class="font-medium text-white mb-4 text-sm">Insights do Mês</h3>

          <div class="space-y-4">
            <div class="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <div class="flex items-center gap-3 mb-2">
                <div class="w-8 h-8 bg-red-600/20 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path>
                  </svg>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Maior Categoria de Gastos</p>
                  <p class="text-sm font-medium text-white">{{ getBiggestExpenseCategory().name }}</p>
                </div>
              </div>
              <p class="text-red-400 font-bold">{{ formatCurrency(getBiggestExpenseCategory().total) }}</p>
            </div>

            <div class="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <div class="flex items-center gap-3 mb-2">
                <div class="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                  </svg>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Maior Categoria de Receitas</p>
                  <p class="text-sm font-medium text-white">{{ getBiggestIncomeCategory().name }}</p>
                </div>
              </div>
              <p class="text-green-400 font-bold">{{ formatCurrency(getBiggestIncomeCategory().total) }}</p>
            </div>

            <div class="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <div class="flex items-center gap-3 mb-2">
                <div class="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7"></path>
                  </svg>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Categoria Mais Frequente</p>
                  <p class="text-sm font-medium text-white">{{ getMostFrequentCategory().name }}</p>
                </div>
              </div>
              <p class="text-blue-400 font-bold">{{ getMostFrequentCategory().count }} transações</p>
            </div>
          </div>
        </div>

        <!-- Filtros por Categoria -->
        <div *ngIf="selectedMonth" class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-medium text-white text-sm">Filtrar por Categoria</h3>
            <button
              *ngIf="selectedCategory"
              (click)="clearFilters()"
              class="text-indigo-400 text-xs hover:text-indigo-300 transition-colors px-3 py-1 rounded-lg bg-indigo-900/30"
            >
              Limpar
            </button>
          </div>

          <select
            [(ngModel)]="selectedCategory"
            (change)="applyFilters()"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          >
            <option value="">Todas as categorias</option>
            <option *ngFor="let category of allCategories" [value]="category">
              {{ getCategoryIcon(category) }} {{ category }}
            </option>
          </select>

          <!-- Info dos filtros ativos -->
          <div *ngIf="selectedCategory" class="mt-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2">
                <span class="text-gray-400">Exibindo:</span>
                <span class="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-medium">
                  {{ selectedCategory }}
                </span>
              </div>
              <span class="text-gray-400">
                {{ filteredTransactions.length }} de {{ selectedMonthTransactions.length }}
              </span>
            </div>
          </div>
        </div>

        <!-- Lista de Transações -->
        <div *ngIf="selectedMonth" class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-medium text-white text-sm">{{ getFilteredSectionTitle() }}</h3>
            <div class="flex items-center gap-2 text-xs">
              <span class="bg-green-600/20 text-green-400 px-2 py-1 rounded-lg border border-green-600/30">
                {{ getFilteredIncomeCount() }}
              </span>
              <span class="bg-red-600/20 text-red-400 px-2 py-1 rounded-lg border border-red-600/30">
                {{ getFilteredExpenseCount() }}
              </span>
            </div>
          </div>

          <!-- Resumo dos Filtros -->
          <div *ngIf="filteredTransactions.length > 0" class="mb-5 bg-gray-700/30 rounded-lg p-4 border border-gray-600">
            <div class="grid grid-cols-3 gap-4 text-center">
              <div>
                <p class="text-xs text-gray-400 mb-1">Receitas</p>
                <p class="text-green-400 font-bold text-sm">
                  {{ formatCurrency(getFilteredTotalIncome()) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-1">Despesas</p>
                <p class="text-red-400 font-bold text-sm">
                  {{ formatCurrency(getFilteredTotalExpenses()) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-1">Saldo</p>
                <p [class]="getFilteredNetBalanceClass()" class="font-bold text-sm">
                  {{ formatCurrency(getFilteredNetBalance()) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Lista das Transações -->
          <div *ngIf="filteredTransactions.length > 0; else noFilteredTransactions" class="space-y-3">
            <div class="max-h-80 overflow-y-auto space-y-3 pr-2">
              <div
                *ngFor="let transaction of filteredTransactions"
                class="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors border border-gray-600/50"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div [class]="getTransactionIconClass(transaction.type)" class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg *ngIf="transaction.type === 'income'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"></path>
                      </svg>
                      <svg *ngIf="transaction.type === 'expense'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"></path>
                      </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-sm font-medium text-white truncate">{{ transaction.description }}</h4>
                      <div class="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        <span>{{ getCategoryIcon(transaction.category) }} {{ transaction.category }}</span>
                        <span>•</span>
                        <span>{{ formatDate(transaction.date) }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div [class]="getAmountClass(transaction.type)" class="font-bold">
                      {{ transaction.type === 'income' ? '+' : '-' }}{{ formatCurrency(getAbsAmount(transaction.amount)) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ng-template #noFilteredTransactions>
            <div class="text-center py-12 text-gray-400">
              <div class="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <h3 class="font-medium text-white mb-2">
                {{ getEmptyStateTitle() }}
              </h3>
              <p class="text-gray-400 mb-6 text-sm">
                {{ getEmptyStateMessage() }}
              </p>
              <div class="space-y-3">
                <button
                  *ngIf="selectedMonthTransactions.length === 0"
                  routerLink="/add-transaction"
                  class="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:bg-indigo-700 transition-all"
                >
                  Nova Transação
                </button>
                <button
                  *ngIf="selectedMonthTransactions.length > 0 && selectedCategory"
                  (click)="clearFilters()"
                  class="bg-gray-700 text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-600 transition-all"
                >
                  Ver Todas do Mês
                </button>
              </div>
            </div>
          </ng-template>
        </div>

        <!-- Estado: Nenhum mês selecionado -->
        <div *ngIf="!selectedMonth && !isLoading && availableMonths.length > 0" class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-8 text-center">
          <div class="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-white mb-2">Selecione um período</h3>
          <p class="text-gray-400 text-sm">Escolha um mês acima para visualizar o histórico detalhado das transações</p>
        </div>

        <!-- Estado: Nenhum histórico -->
        <div *ngIf="!isLoading && availableMonths.length === 0" class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-8 text-center">
          <div class="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <h3 class="text-xl font-medium text-white mb-3">Nenhum histórico encontrado</h3>
          <p class="text-gray-400 mb-6 text-sm">Comece adicionando suas primeiras transações para acompanhar suas finanças</p>
          <a
            routerLink="/add-transaction"
            class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Adicionar Transação
          </a>
        </div>
      </div>
    </div>
  `
})
export class MonthlyHistoryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;

  availableMonths: MonthData[] = [];
  selectedMonth: MonthData | null = null;
  selectedMonthStats: MonthlyStats | null = null;
  selectedMonthTransactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  isLoading = true;
  isLoadingMonthData = false;

  // Filter properties
  selectedCategory = '';
  allCategories: string[] = [];

  pieChart: Chart | null = null;
  barChart: Chart | null = null;

  private destroy$ = new Subject<void>();
  private monthSelect$ = new Subject<MonthData | null>();

  constructor(private financeService: FinanceService) {
    // Configurar debounce para seleção de mês
    this.monthSelect$
      .pipe(
        debounceTime(150), // Aguardar 150ms entre mudanças
        distinctUntilChanged((prev, curr) => prev?.monthYear === curr?.monthYear),
        takeUntil(this.destroy$)
      )
      .subscribe(month => this.loadMonthData(month));
  }

  ngOnInit() {
    this.loadAvailableMonths();
  }

  ngAfterViewInit() {
    // Charts are not needed in simple version
  }

  loadAvailableMonths() {
    this.isLoading = true;
    // Não resetar dados existentes durante o carregamento

    this.financeService.getAvailableMonths()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (months) => {
          this.availableMonths = months;

          if (this.availableMonths.length > 0) {
            // Select the most recent month by default
            this.selectedMonth = this.availableMonths[0];
            // Usar loadMonthData diretamente para evitar debounce inicial
            this.loadMonthData(this.selectedMonth);
          } else {
            this.isLoading = false;
          }
        },
        error: (error) => {
          console.error('Error loading months:', error);
          this.isLoading = false;
        }
      });
  }

  onMonthSelect(month: MonthData | null) {
    // Usar o Subject para debounce
    this.monthSelect$.next(month);
  }

  private loadMonthData(month: MonthData | null) {
    if (!month) {
      this.selectedMonthStats = null;
      this.selectedMonthTransactions = [];
      this.isLoadingMonthData = false;
      this.isLoading = false;
      return;
    }

    // Não resetar dados imediatamente para evitar piscada
    this.selectedMonth = month;

    // Se é o primeiro carregamento, usar isLoading, senão usar isLoadingMonthData
    if (this.isLoading) {
      // Primeiro carregamento - manter loading geral ativo
    } else {
      // Mudança de mês - usar loading específico
      this.isLoadingMonthData = true;
      // Só limpar dados se for uma mudança de mês diferente
      if (this.selectedMonthStats?.month !== month.monthYear) {
        this.selectedMonthStats = null;
        this.selectedMonthTransactions = [];
      }
    }

    const [yearStr, monthStr] = month.monthYear.split('-');
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);

    // Usar Promise.all para aguardar ambas as operações
    const summaryPromise = this.financeService.getMonthlySummary(month.monthYear)
      .pipe(takeUntil(this.destroy$))
      .toPromise();

    const transactionsPromise = this.financeService.getTransactions({ year, month: monthNum })
      .pipe(takeUntil(this.destroy$))
      .toPromise();

    Promise.allSettled([summaryPromise, transactionsPromise])
      .then(([summaryResult, transactionsResult]) => {
        // Verificar se o componente ainda está ativo
        if (this.destroy$.closed) return;

        let summary: any = null;
        let monthTransactions: any[] = [];

        // Processar resultado do resumo
        if (summaryResult.status === 'fulfilled' && summaryResult.value) {
          summary = summaryResult.value;
        }

        // Processar resultado das transações
        if (transactionsResult.status === 'fulfilled' && transactionsResult.value) {
          monthTransactions = transactionsResult.value;
        }

        // Atualizar dados
        this.selectedMonthTransactions = monthTransactions;

        // Extrair categorias do mês selecionado e aplicar filtros
        this.extractCategories();
        this.applyFilters();

        if (summary) {
          // Usar dados do resumo
          this.selectedMonthStats = {
            month: summary.month,
            totalIncome: summary.summary.totalIncome,
            totalExpenses: summary.summary.totalExpenses,
            balance: summary.summary.balance,
            expensesByCategory: {}
          };
        } else {
          // Calcular estatísticas a partir das transações
          const totalIncome = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

          const totalExpenses = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

          this.selectedMonthStats = {
            month: month.monthYear,
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            expensesByCategory: {}
          };
        }

        // Finalizar loading apenas quando tudo estiver pronto
        this.isLoadingMonthData = false;
        this.isLoading = false; // Garantir que loading geral também seja finalizado
      })
      .catch((error) => {
        console.error('Error loading month data:', error);
        if (!this.destroy$.closed) {
          this.isLoadingMonthData = false;
          this.isLoading = false;
        }
      });
  }

  formatMonthYear(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatAmount(value: number): string {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  getTransactionIconClass(type: string): string {
    return type === 'income'
      ? 'bg-green-600/20 text-green-400 border border-green-600/30'
      : 'bg-red-600/20 text-red-400 border border-red-600/30';
  }

  getAmountClass(type: string): string {
    return type === 'income' ? 'text-green-400' : 'text-red-400';
  }

  getAbsAmount(amount: number): number {
    return Math.abs(amount);
  }

  getIncomeTransactionCount(): number {
    return this.selectedMonthTransactions.filter(t => t.type === 'income').length;
  }

  getExpenseTransactionCount(): number {
    return this.selectedMonthTransactions.filter(t => t.type === 'expense').length;
  }

  // Category Analysis Methods
  getExpensesByCategory(): any[] {
    const expenses = this.selectedMonthTransactions.filter(t => t.type === 'expense');
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const categoryMap = new Map<string, { total: number; count: number; transactions: any[] }>();

    expenses.forEach(expense => {
      const category = expense.category;
      const amount = Math.abs(expense.amount);

      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        existing.total += amount;
        existing.count++;
        existing.transactions.push(expense);
      } else {
        categoryMap.set(category, {
          total: amount,
          count: 1,
          transactions: [expense]
        });
      }
    });

    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      average: data.total / data.count,
      percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 100) : 0,
      transactions: data.transactions
    })).sort((a, b) => b.total - a.total);
  }

  getIncomesByCategory(): any[] {
    const incomes = this.selectedMonthTransactions.filter(t => t.type === 'income');
    const totalIncome = incomes.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const categoryMap = new Map<string, { total: number; count: number; transactions: any[] }>();

    incomes.forEach(income => {
      const category = income.category;
      const amount = Math.abs(income.amount);

      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        existing.total += amount;
        existing.count++;
        existing.transactions.push(income);
      } else {
        categoryMap.set(category, {
          total: amount,
          count: 1,
          transactions: [income]
        });
      }
    });

    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      average: data.total / data.count,
      percentage: totalIncome > 0 ? Math.round((data.total / totalIncome) * 100) : 0,
      transactions: data.transactions
    })).sort((a, b) => b.total - a.total);
  }

  getTotalExpenses(): number {
    return this.selectedMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  getTotalIncome(): number {
    return this.selectedMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  getBiggestExpenseCategory(): { name: string; total: number } {
    const expenses = this.getExpensesByCategory();
    return expenses.length > 0 ? expenses[0] : { name: 'Nenhuma', total: 0 };
  }

  getBiggestIncomeCategory(): { name: string; total: number } {
    const incomes = this.getIncomesByCategory();
    return incomes.length > 0 ? incomes[0] : { name: 'Nenhuma', total: 0 };
  }

  getMostFrequentCategory(): { name: string; count: number } {
    const allCategories = [...this.getExpensesByCategory(), ...this.getIncomesByCategory()];
    const mostFrequent = allCategories.sort((a, b) => b.count - a.count)[0];
    return mostFrequent ? { name: mostFrequent.name, count: mostFrequent.count } : { name: 'Nenhuma', count: 0 };
  }

  getCategoryIcon(categoryName: string): string {
    const icons: { [key: string]: string } = {
      'Alimentação': '🍽️',
      'Transporte': '🚗',
      'Moradia': '🏠',
      'Saúde': '🏥',
      'Educação': '📚',
      'Lazer': '🎮',
      'Compras': '🛒',
      'Outros': '📋',
      'Salário': '💰',
      'Freelance': '💼',
      'Investimentos': '📈',
      'Vendas': '💳',
      'Presente': '🎁'
    };
    return icons[categoryName] || '📋';
  }

  // Verificar se deve mostrar conteúdo ou loading
  shouldShowContent(): boolean {
    return !this.isLoading && !this.isLoadingMonthData && this.selectedMonth != null;
  }

  // Verificar se deve mostrar loading de transição
  shouldShowTransitionLoading(): boolean {
    return this.isLoadingMonthData && !this.isLoading && this.selectedMonth != null;
  }

  // Filter methods for selected month transactions

  extractCategories() {
    // Extrair categorias apenas das transações do mês selecionado
    const categories = [...new Set(this.selectedMonthTransactions.map(t => t.category))];
    this.allCategories = categories.sort();
  }

  applyFilters() {
    // Filtrar apenas as transações do mês selecionado
    let filtered = [...this.selectedMonthTransactions];

    if (this.selectedCategory) {
      filtered = filtered.filter(t => t.category === this.selectedCategory);
    }

    this.filteredTransactions = filtered;
  }

  clearFilters() {
    this.selectedCategory = '';
    this.filteredTransactions = [...this.selectedMonthTransactions];
  }

  // Statistics for filtered transactions
  getFilteredTotalIncome(): number {
    return this.filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  getFilteredTotalExpenses(): number {
    return this.filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  getFilteredNetBalance(): number {
    return this.getFilteredTotalIncome() - this.getFilteredTotalExpenses();
  }

  getFilteredNetBalanceClass(): string {
    const balance = this.getFilteredNetBalance();
    if (balance > 0) return 'text-green-400';
    if (balance < 0) return 'text-red-400';
    return 'text-gray-400';
  }

  getFilteredIncomeCount(): number {
    return this.filteredTransactions.filter(t => t.type === 'income').length;
  }

  getFilteredExpenseCount(): number {
    return this.filteredTransactions.filter(t => t.type === 'expense').length;
  }

  getFilteredSectionTitle(): string {
    if (!this.selectedMonth) return 'Transações';

    const monthName = this.formatMonthYear(this.selectedMonth.monthYear);

    if (this.selectedCategory) {
      return `${this.selectedCategory} (${monthName})`;
    }

    return `Transações de ${monthName}`;
  }

  getEmptyStateTitle(): string {
    if (this.selectedCategory) {
      return `Nenhuma transação na categoria "${this.selectedCategory}"`;
    }

    return 'Nenhuma transação';
  }

  getEmptyStateMessage(): string {
    if (this.selectedMonthTransactions.length === 0) {
      return "Não há transações neste mês.";
    }

    if (this.selectedCategory) {
      return `Não há transações na categoria "${this.selectedCategory}" neste mês.`;
    }

    return "Nenhuma transação encontrada neste mês.";
  }



  ngOnDestroy() {
    // Cancelar todas as subscrições ativas
    this.destroy$.next();
    this.destroy$.complete();

    // Limpar gráficos
    if (this.pieChart) {
      this.pieChart.destroy();
    }
    if (this.barChart) {
      this.barChart.destroy();
    }
  }
}
