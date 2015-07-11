/* jshint node: true, esnext: true */
'use strict';

let _ = require('lodash');
let lazy = require('lazy');
let readline = require('readline');

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * CONSTANTES
 */
let MONTH_IN_MILLISECONDS = 1000 * 60 * 60 * 24 * 30;
let TIEMPO_FINAL = 12 * MONTH_IN_MILLISECONDS;

let HIGH_VALUE = Number.MAX_VALUE;
let COSTO_FIREBASE = 449;
let MAXIMA_CANTIDAD_REQUEST_CONCURRENTES = 100;

let initArray = (n, value) => _.times(n, _.constant(value));

let log = console.info;

let getMenorTPS = function(tps, n) {
  let min_index = 0;
  lazy(tps)
    .take(n * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .forEach(function(value, index) {
      if (value < tps[min_index]) {
        min_index = index;
      }
    });
  return min_index;
};

let getAtencion = (tamanioArchivo) => {
  return {
    tiempo: 100,
    costo: 100
  };
};

let getIntervaloArribos = () => {
  let x = Math.random();
  let y = Math.pow(1 / Math.pow(x, 3.07759) - 1, 0.51182);

  if (isNaN(y) || y < 0) {
    throw new Error(y);
  }
  return y;
};

let getTamanioArchivo = () => 1;

let getNumeroWorker = (thread) =>  Math.floor(thread / MAXIMA_CANTIDAD_REQUEST_CONCURRENTES);

let estaVacioWorker = (menor_salida, tps, n) =>
  lazy(tps)
    .drop(getNumeroWorker(menor_salida) * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .take(MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .all((e) => e === HIGH_VALUE);

let getPuestoLibre = (tps, n) =>
  _(tps)
    .take(n * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .findIndex(function(value) {
      return value === HIGH_VALUE;
    });

let getCantidadRequestAtendiendose = (tps, n) =>
  lazy(tps)
    .take(n * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .filter((x) => x !== HIGH_VALUE)
    .toArray()
    .length;

let hayQueVaciar = (tps, n) => getCantidadRequestAtendiendose(tps, n) !== 0;

let run = (minimo_servidores, maximo_servidores, req_max_esperando) => {

  let CANTIDAD_WORKERS_ACTIVOS = minimo_servidores;
  let CANTIDAD_REQUESTS = 0;
  let TIEMPO = 0;
  let TPLL = 0;
  let TPS = initArray(MAXIMA_CANTIDAD_REQUEST_CONCURRENTES * maximo_servidores, HIGH_VALUE);

  let costo_por_requests = 0;
  let sumatoria_tiempos_atencion = 0;
  let sumatoria_llegadas = 0;
  let sumatoria_salidas = 0;

  while (TIEMPO <= TIEMPO_FINAL) {

    let menor_salida = getMenorTPS(TPS);
    log('Menor TPS', menor_salida);

    if (TPLL <= TPS[menor_salida]) { // LLEGADA

      CANTIDAD_REQUESTS ++;

      TIEMPO = TPLL;
      log('[LLEGADA] Avanzo hasta', TIEMPO);

      let INTERVALO_ENTRE_REQUEST = getIntervaloArribos();
      TPLL = TIEMPO + INTERVALO_ENTRE_REQUEST;

      if (CANTIDAD_REQUESTS <= CANTIDAD_WORKERS_ACTIVOS * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES) {

        let libre = getPuestoLibre(TPS);
        let TAMANIO_ARCHIVO = getTamanioArchivo();
        let atencion = getAtencion(TAMANIO_ARCHIVO);
        TPS[libre] = TIEMPO + atencion.tiempo;
        sumatoria_tiempos_atencion = sumatoria_tiempos_atencion + atencion.tiempo;

        sumatoria_llegadas = sumatoria_llegadas + TIEMPO;
        costo_por_requests = costo_por_requests + atencion.costo;

      } else {

        let req_esperando = CANTIDAD_REQUESTS - getCantidadRequestAtendiendose(TPS, MAXIMA_CANTIDAD_REQUEST_CONCURRENTES) - 1;

        if (req_esperando === req_max_esperando) {

          if (CANTIDAD_WORKERS_ACTIVOS < maximo_servidores) {

            CANTIDAD_WORKERS_ACTIVOS++;
            log('Prendiendo un equipo... ', CANTIDAD_WORKERS_ACTIVOS);

            let cantidad_de_request_a_atender = Math.min(req_esperando, MAXIMA_CANTIDAD_REQUEST_CONCURRENTES);

            for (let i = 0; i < cantidad_de_request_a_atender; i++) {
              let libre = getPuestoLibre(TPS);
              let TAMANIO_ARCHIVO = getTamanioArchivo();
              let atencion = getAtencion(TAMANIO_ARCHIVO);
              TPS[libre] = TIEMPO + atencion.tiempo;
              sumatoria_tiempos_atencion = sumatoria_tiempos_atencion + atencion.tiempo;
              costo_por_requests = costo_por_requests + atencion.costo;
            }

          }

        }

      }

    } else { // SALIDA

      CANTIDAD_REQUESTS --;

      TIEMPO = TPS[menor_salida];
      log('[SALIDA] Avanzo hasta', TIEMPO);

      if (estaVacioWorker(menor_salida, TPS, CANTIDAD_WORKERS_ACTIVOS)) {
        CANTIDAD_WORKERS_ACTIVOS --;
        log('Apagando un equipo... ', CANTIDAD_WORKERS_ACTIVOS);
      }

      if (CANTIDAD_REQUESTS >= CANTIDAD_WORKERS_ACTIVOS * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES) {

        let TAMANIO_ARCHIVO = getTamanioArchivo();
        let atencion = getAtencion(TAMANIO_ARCHIVO);
        TPS[menor_salida] = TIEMPO + atencion.tiempo;
        sumatoria_tiempos_atencion = sumatoria_tiempos_atencion + atencion.tiempo;
        costo_por_requests = costo_por_requests + atencion.costo;

      } else {
        TPS[menor_salida] = HIGH_VALUE;
      }

      sumatoria_salidas = sumatoria_salidas + TIEMPO;

    }

    // ALWAYS

    if (TIEMPO > TIEMPO_FINAL) {
      if (hayQueVaciar(TPS, CANTIDAD_WORKERS_ACTIVOS)) {
        TPLL = HIGH_VALUE;
      } else {
        break;
      }
    }

  }

  let costo_total = costo_por_requests + COSTO_FIREBASE;
  let prom_costo = costo_total / (TIEMPO_FINAL / MONTH_IN_MILLISECONDS);
  let prom_espera = (sumatoria_salidas - sumatoria_llegadas - sumatoria_tiempos_atencion) / CANTIDAD_REQUESTS;
  let prom_respuesta = (sumatoria_salidas - sumatoria_llegadas) / CANTIDAD_REQUESTS;

  log(sumatoria_salidas);
  log(sumatoria_llegadas);
  log(sumatoria_tiempos_atencion);

  console.log('');
  console.log('==============================================================================');
  console.log('');
  console.log("Cantidad mínima de workers", minimo_servidores);
  console.log("Cantidad máximo de workers", maximo_servidores);
  console.log("Cantidad máxima de request en cola antes de levantar otro worker", req_max_esperando);
  console.log('');
  console.log("Promedio de costo mensual", prom_costo);
  console.log("Promedio de espera de un request", prom_espera);
  console.log("Promedio de tiempo de respuesta", prom_respuesta);
  console.log('');
  console.log('==============================================================================');

  process.exit(0);

};

rl.question('Cantidad de workers mínimo? ', (min) => {
  rl.question('? ', (max) => {
    rl.question('Cantidad máxima de request en cola antes de levantar otro worker? ', (max_cola) => {
      run(parseInt(min), parseInt(max), parseInt(max_cola));
    });
  });
});

