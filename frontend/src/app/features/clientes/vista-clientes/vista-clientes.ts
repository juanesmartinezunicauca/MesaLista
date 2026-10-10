import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { Router } from '@angular/router';

export interface ClienteDirectorioItem {
  id_cliente: number;
  nombre: string;
  telefono: string;
  direccion: string;
  total_pedidos: number;
  total_facturas: number;
  ultimo_pedido: string | null;
}

@Component({
  selector: 'app-vista-clientes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './vista-clientes.html',
  styleUrl: './vista-clientes.scss',
})
export class VistaClientesComponent implements OnInit {
  private domiciliosApi = inject(DomiciliosApiService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  clientes = signal<ClienteDirectorioItem[]>([]);
  cargando = signal<boolean>(false);
  busqueda = signal<string>('');

  // Métricas computadas
  metricas = computed(() => {
    const list = this.clientes();
    const total = list.length;
    const conPedidos = list.filter((c) => c.total_pedidos > 0).length;
    const totalDomicilios = list.reduce((acc, c) => acc + (c.total_pedidos || 0), 0);
    return { total, conPedidos, totalDomicilios };
  });

  // Lista filtrada reactivamente
  clientesFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.clientes();

    return this.clientes().filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.includes(q) ||
        c.direccion.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.cargarClientes();
  }

  cargarClientes(): void {
    this.cargando.set(true);
    this.domiciliosApi.obtenerClientes().subscribe({
      next: (data) => {
        this.clientes.set(data || []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar directorio de clientes', 'Cerrar', { duration: 3000 });
      },
    });
  }

  abrirWhatsApp(telefono: string, nombre: string): void {
    const cleanPhone = telefono.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const mensaje = encodeURIComponent(`¡Hola ${nombre}! Te saludamos de MesaLista Restaurant.`);
    window.open(`https://wa.me/${fullPhone}?text=${mensaje}`, '_blank');
  }

  llamarCliente(telefono: string): void {
    window.open(`tel:${telefono}`, '_self');
  }

  irAHistorialDomicilios(): void {
    this.router.navigate(['/historial'], { queryParams: { tab: 'domicilios' } });
  }
}
