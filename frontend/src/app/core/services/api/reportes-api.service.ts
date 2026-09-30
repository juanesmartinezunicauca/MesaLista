import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FiltroReporte, ResumenReporte, TurnoCajaReporte } from '../../models';

@Injectable({
  providedIn: 'root',
})
export class ReportesApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/reportes`;

  /**
   * Obtiene el consolidado analítico de ventas, KPIs y desglose según el filtro.
   */
  obtenerResumen(filtro: FiltroReporte): Observable<ResumenReporte> {
    let params = new HttpParams().set('periodo', filtro.periodo);
    if (filtro.periodo === 'personalizado') {
      if (filtro.fecha_inicio) params = params.set('fecha_inicio', filtro.fecha_inicio);
      if (filtro.fecha_fin) params = params.set('fecha_fin', filtro.fecha_fin);
    }
    return this.http.get<ResumenReporte>(`${this.apiUrl}/resumen`, { params });
  }

  /**
   * Obtiene el histórico de turnos y arqueos de caja para auditoría.
   */
  obtenerTurnosCaja(limite = 15): Observable<TurnoCajaReporte[]> {
    const params = new HttpParams().set('limite', limite.toString());
    return this.http.get<TurnoCajaReporte[]>(`${this.apiUrl}/turnos-caja`, { params });
  }

  /**
   * Descarga el reporte consolidado en formato CSV.
   */
  descargarCsv(filtro: FiltroReporte): Observable<Blob> {
    let params = new HttpParams().set('periodo', filtro.periodo);
    if (filtro.periodo === 'personalizado') {
      if (filtro.fecha_inicio) params = params.set('fecha_inicio', filtro.fecha_inicio);
      if (filtro.fecha_fin) params = params.set('fecha_fin', filtro.fecha_fin);
    }
    return this.http.get(`${this.apiUrl}/exportar-csv`, {
      params,
      responseType: 'blob',
    });
  }
}
