import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-outer-header',
  styleUrl: './outer-header.scss',
  templateUrl: './outer-header.html',
})
export class OuterHeader {}

// import { Component, inject } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { MatButtonModule } from '@angular/material/button';
// import { MatIconModule } from '@angular/material/icon';
// import { MatMenuModule } from '@angular/material/menu';
// import { AuthService } from '../../core/auth/auth.service'; // Ajusta la ruta según tu proyecto

// @Component({
//   selector: 'app-header',
//   standalone: true,
//   imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule],
//   template: `
//     <header class="app-outer-header">
//       <div class="header-brand-info">
//         <span class="welcome-text">Panel de Gestión</span>
//       </div>

//       <div class="user-session-container">
//         @if (authService.user(); as user) {
//           <div class="user-meta">
//             <span class="user-name">{{ user.name }}</span>
//             <!-- Suponiendo que el rol se extrae de los claims o propiedades del usuario -->
//             <span class="user-role">Administrador</span>
//           </div>

//           <button
//             mat-icon-button
//             [matMenuTriggerFor]="menu"
//             aria-label="Menú de usuario"
//             class="avatar-btn"
//           >
//             <img
//               [src]="user.picture || 'https://ui-avatars.com/api/?name=User'"
//               alt="Avatar"
//               class="header-avatar"
//             />
//           </button>

//           <mat-menu #menu="matMenu" xPosition="before">
//             <button mat-menu-item (click)="authService.logout()">
//               <mat-icon color="warn">logout</mat-icon>
//               <span>Cerrar sesión</span>
//             </button>
//           </mat-menu>
//         }
//       </div>
//     </header>
//   `,
//   styles: [
//     `
//       .app-outer-header {
//         height: 64px;
//         background-color: #ffffff;
//         border-bottom: 1px solid #e5e7eb;
//         display: flex;
//         align-items: center;
//         justify-content: space-between;
//         padding: 0 24px;
//         width: 100%;
//         box-sizing: border-box;

//         .header-brand-info {
//           .welcome-text {
//             font-size: 1rem;
//             font-weight: 600;
//             color: #1f2937;
//           }
//         }

//         .user-session-container {
//           display: flex;
//           align-items: center;
//           gap: 12px;

//           .user-meta {
//             display: flex;
//             flex-direction: column;
//             align-items: flex-end;

//             .user-name {
//               font-size: 0.875rem;
//               font-weight: 600;
//               color: #1f2937;
//             }

//             .user-role {
//               font-size: 0.75rem;
//               color: #6b7280;
//               text-transform: capitalize;
//             }
//           }

//           .avatar-btn {
//             width: 40px;
//             height: 40px;
//             padding: 0;
//             border-radius: 50%;
//             overflow: hidden;

//             .header-avatar {
//               width: 100%;
//               height: 100%;
//               object-fit: cover;
//             }
//           }
//         }
//       }
//     `,
//   ],
// })
// export class HeaderComponent {
//   authService = inject(AuthService);
// }
