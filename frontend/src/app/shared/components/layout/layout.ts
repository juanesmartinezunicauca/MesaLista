import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar';
import { OuterHeaderComponent } from '../outer-header/outer-header';

@Component({
  imports: [CommonModule, RouterOutlet, SidebarComponent, OuterHeaderComponent],
  selector: 'app-layout',
  styleUrl: './layout.scss',
  templateUrl: './layout.html',
})
export class Layout {}
