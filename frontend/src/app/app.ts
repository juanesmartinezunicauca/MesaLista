import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ListaProductosComponent } from '@features/catalogo/lista-productos/lista-productos';
import { SidebarComponent } from '@shared/components/sidebar/sidebar';
import { Layout } from '@shared/components/layout/layout';
import { ProductoFormComponent } from '@features/catalogo/producto-form/producto-form';
import { BorradorPedidoComponent } from '@features/mesas/borrador-pedido/borrador-pedido';
import { DetalleMesaComponent } from '@features/mesas/detalle-mesa/detalle-mesa';
import { ListaUsuariosComponent } from '@features/usuarios/lista-usuarios/lista-usuarios';
import { MiPerfilDialogComponent } from '@features/usuarios/mi-perfil-dialog/mi-perfil-dialog';
import { CierreDeCaja } from '@features/caja/arqueo-cierre/arqueo-caja';

@Component({
  imports: [RouterOutlet, ListaProductosComponent, SidebarComponent, Layout, ProductoFormComponent, BorradorPedidoComponent, DetalleMesaComponent, ListaUsuariosComponent, MiPerfilDialogComponent, CierreDeCaja],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('MesaLista');
}
