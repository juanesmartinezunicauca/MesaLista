import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Angular Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

interface CustomizableIngredient {
  id: string;
  name: string;
  enabled: boolean;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule
  ],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss'
})
export class InventoryComponent {
  private fb = inject(FormBuilder);

  productForm: FormGroup;

  // Signal para gestionar la lista de ingredientes personalizables de forma reactiva
  ingredients = signal<CustomizableIngredient[]>([
    { id: '1', name: 'Cebolla', enabled: true },
    { id: '2', name: 'Tomate', enabled: true },
    { id: '3', name: 'Salsa Especial', enabled: true },
    { id: '4', name: 'Pepinillos', enabled: false }
  ]);

  categories: string[] = ['Platos Fuertes', 'Entradas', 'Bebidas', 'Postres'];

  constructor() {
    this.productForm = this.fb.group({
      name: ['Hamburguesa Clásica', [Validators.required]],
      category: ['Platos Fuertes', [Validators.required]],
      shortDescription: ['Carne de res 150g, queso cheddar, lechuga, tomate y salsa especial.', [Validators.required]],
      price: [15.00, [Validators.required, Validators.min(0)]],
      cost: [4.50, [Validators.required, Validators.min(0)]]
    });
  }

  // Cálculo computado del margen estimado basado en precio y costo
  get estimatedMargin(): string {
    const price = this.productForm.get('price')?.value || 0;
    const cost = this.productForm.get('cost')?.value || 0;
    if (price <= 0) return '0%';
    const margin = ((price - cost) / price) * 100;
    return `${Math.round(margin)}%`;
  }

  toggleIngredient(id: string): void {
    this.ingredients.update(list =>
      list.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item)
    );
  }

  onSave(): void {
    if (this.productForm.valid) {
      const formData = {
        ...this.productForm.value,
        ingredients: this.ingredients()
      };
      console.log('Guardando cambios del producto:', formData);
      // Lógica para enviar al backend o servicio de inventario
    } else {
      this.productForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    console.log('Edición cancelada');
  }
}