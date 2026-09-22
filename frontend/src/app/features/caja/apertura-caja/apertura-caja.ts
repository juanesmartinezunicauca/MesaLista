import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Angular Material Modules
import { MatCardContent, MatCard } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-apertura-caja',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatCardContent,
    MatCard,
  ],
  templateUrl: './apertura-caja.html',
  styleUrl: './apertura-caja.scss',
})
export class AperturaCajaComponent implements OnInit {
  ngOnInit(): void {
    this.imagen = this.imagen?.trim() ?? '';
    this.titulo = this.titulo?.trim() ?? '';
    this.descripcion = this.descripcion?.trim() ?? '';
    this.textoBoton = this.textoBoton?.trim() || 'Ver más';
  }
  private router = inject(Router);

  @Input() imagen: string = '';
  @Input() titulo: string = '';
  @Input() descripcion: string = '';
  @Input() textoBoton: string = 'Ver más';

  @Output() onClickBoton = new EventEmitter<void>();

  ejecutarAccion(): void {
    this.onClickBoton.emit();
  }

  soloNumeros(event: KeyboardEvent): boolean {
    const charCode = event.key;
    // Permite solo caracteres numéricos del 0 al 9
    if (/[0-9]/.test(charCode)) {
      return true;
    }
    event.preventDefault();
    return false;
  }
}
