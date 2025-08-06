import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FinanceService, Transaction } from '../../../services/finance.service';

@Component({
  selector: 'app-add-transaction',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './add-transaction.component.html'
})
export class AddTransactionComponent implements OnInit {
  transactionForm: FormGroup;
  isSubmitting = false;
  isEditMode = false;
  transactionId: string | null = null;

  incomeCategories = [
    'Salário',
    'Investimentos',
    'Vendas',
    'Bonificações',
    'Outros'
  ];

  expenseCategories = [
    'Alimentação',
    'Transporte',
    'Moradia',
    'Saúde',
    'Educação',
    'Entretenimento',
    'Compras',
    'Contas',
    'Outros'
  ];

  constructor(
    private formBuilder: FormBuilder,
    private financeService: FinanceService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.transactionForm = this.formBuilder.group({
      type: ['income', Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      category: ['', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required]
    });
  }

  ngOnInit() {
    // Check if we're in edit mode
    this.transactionId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.transactionId;

    if (this.isEditMode && this.transactionId) {
      this.loadTransaction(this.transactionId);
    }

    // Watch for type changes to update categories
    this.transactionForm.get('type')?.valueChanges.subscribe(() => {
      this.transactionForm.get('category')?.setValue('');
    });
  }

  loadTransaction(id: string) {
    this.financeService.getTransactions().subscribe({
      next: (transactions) => {
        const transaction = transactions.find(t => t.id === id);
        if (transaction) {
          // Format date for input
          const dateString = new Date(transaction.date).toISOString().split('T')[0];

          this.transactionForm.patchValue({
            type: transaction.type,
            description: transaction.description,
            amount: Math.abs(transaction.amount), // Always show positive value
            category: transaction.category,
            date: dateString
          });
        }
      },
      error: (error) => {
        console.error('Erro ao carregar transação:', error);
        this.router.navigate(['/transactions']);
      }
    });
  }

  getCategories(): string[] {
    const type = this.transactionForm.get('type')?.value;
    return type === 'income' ? this.incomeCategories : this.expenseCategories;
  }

  onSubmit() {
    if (this.transactionForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      const formValue = this.transactionForm.value;

      // Criar data correta a partir do input date
      const [year, month, day] = formValue.date.split('-').map(Number);
      const correctedDate = new Date(year, month - 1, day);

      const transactionData = {
        type: formValue.type,
        description: formValue.description.trim(),
        amount: formValue.type === 'expense' ? -Math.abs(parseFloat(formValue.amount)) : Math.abs(parseFloat(formValue.amount)),
        category: formValue.category,
        date: correctedDate
      };

      if (this.isEditMode && this.transactionId) {
        // Update existing transaction
        this.financeService.updateTransaction(this.transactionId, transactionData).subscribe({
          next: (updatedTransaction) => {
            this.isSubmitting = false;
            console.log('Transação atualizada:', updatedTransaction);
            this.router.navigate(['/transactions']);
          },
          error: (error) => {
            this.isSubmitting = false;
            console.error('Erro ao atualizar transação:', error);
            alert('Erro ao atualizar transação. Tente novamente.');
          }
        });
      } else {
        // Create new transaction
        this.financeService.addTransaction(transactionData).subscribe({
          next: (savedTransaction) => {
            this.isSubmitting = false;
            console.log('Transação salva:', savedTransaction);
            this.router.navigate(['/dashboard']);
          },
          error: (error) => {
            this.isSubmitting = false;
            console.error('Erro ao salvar transação:', error);
            alert('Erro ao salvar transação. Tente novamente.');
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.transactionForm.controls).forEach(key => {
      const control = this.transactionForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.transactionForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.transactionForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} é obrigatório`;
      }
      if (field.errors['min']) {
        return 'Valor deve ser maior que zero';
      }
      if (field.errors['minlength']) {
        return 'Descrição deve ter pelo menos 3 caracteres';
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'type': 'Tipo',
      'description': 'Descrição',
      'amount': 'Valor',
      'category': 'Categoria',
      'date': 'Data'
    };
    return labels[fieldName] || fieldName;
  }
}