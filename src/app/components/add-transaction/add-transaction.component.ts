import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { FinanceService } from '../../../services/finance.service';

@Component({
  selector: 'app-add-transaction',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './add-transaction.component.html'
})
export class AddTransactionComponent implements OnInit {
  transactionForm: FormGroup;
  isSubmitting = false;

  incomeCategories = [
    'Salário',
    'Freelance',
    'Investimentos',
    'Vendas',
    'Prêmios',
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
    private router: Router
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
    // Watch for type changes to update categories
    this.transactionForm.get('type')?.valueChanges.subscribe(() => {
      this.transactionForm.get('category')?.setValue('');
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
      const correctedDate = new Date(year, month - 1, day); // month-1 porque Date usa 0-indexed

      const transaction = {
        type: formValue.type,
        description: formValue.description.trim(),
        amount: formValue.type === 'expense' ? -Math.abs(parseFloat(formValue.amount)) : Math.abs(parseFloat(formValue.amount)),
        category: formValue.category,
        date: correctedDate // ← Data corrigida
      };

      console.log('Data selecionada:', formValue.date); // Ex: "2024-08-04"
      console.log('Data criada:', correctedDate); // Ex: Sun Aug 04 2024

      this.financeService.addTransaction(transaction).subscribe({
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