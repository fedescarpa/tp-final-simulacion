/* jshint node: true, esnext: true */
'use strict';

let _ = require('lodash');
let lazy = require('lazy.js');
let readline = require('readline');

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * CONSTANTES
 */
let MONTHS = 12;
let MONTH_IN_MILLISECONDS = 1000 * 60 * 60 * 24 * 30;
let TIEMPO_FINAL = MONTHS * MONTH_IN_MILLISECONDS;

let HIGH_VALUE = Number.MAX_VALUE;
let COSTO_FIREBASE = 449;
let MAXIMA_CANTIDAD_REQUEST_CONCURRENTES = 20000;
let COSTO_EQUIPO = 0.0074 / (1000 * 60 * 60);
let COSTO_ENCENDIDO = 0.02;

let initArray = (n, value) => _.times(n, _.constant(value));

let log = console.info;

let getCompresion = () => {
  const R = Math.random();
  return R <= 0.0209 ? 0.92 :
         R <= 0.0771 ? 0.98 :
         R <= 0.1787 ? 0.96 :
         R <= 0.3392 ? 0.90 :
         R <= 0.5870 ? 0.17 : 0.14;
};

let getAtencion = (tamanioArchivo) => {
  const _128MBxSegEn1KBxMilisegundo = 131.072;
  const tamanioComprimido = getCompresion() * tamanioArchivo;
  const cantidadDeRequest = Math.ceil(tamanioComprimido / 64);
  return {
    tiempo: Math.ceil(tamanioComprimido * _128MBxSegEn1KBxMilisegundo) + 30,
    costo: cantidadDeRequest * (0.000005 + 0.0000004)
  };
};

let getIntervaloArribos = () => {
  const el = Math.pow;
  const k = 0.2328;
  const a = 1.4122;
  const b = 1369.2;
  let R, ret;
  do {
    R = Math.random();
    ret = b * el(el(R, -1/k) - 1, (-1/a));
  } while (!isFinite(ret) || ret <= 0);
  return Math.ceil(ret + 10);
};

let ln = (n) => Math.log(n) / Math.log(Math.E);
let tan = (n) => Math.tan(n);

let getTamanioArchivo = () => {
  const o = 2.3797E+7;
  const u = 2.9383E+6;
  const pi = Math.PI;
  let ret, R, RxPi;
  do {
    R = Math.random();
    RxPi = R * pi;
    ret = ((2 * o * ln(tan(RxPi/2))) / pi) + u;
  } while (ret <= 0);
  return Math.ceil(ret / 1024);
};

let getNumeroWorker = (thread) =>  Math.floor(thread / MAXIMA_CANTIDAD_REQUEST_CONCURRENTES);

let getMenorTPS = (tps, n) => {
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

let estaVacioWorker = (menor_salida, tps, n) =>
  lazy(tps)
    .drop(getNumeroWorker(menor_salida) * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .take(MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .all((e) => e === HIGH_VALUE);

let getPuestoLibre = (tps, n) =>
  lazy(tps)
    .take(n * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .indexOf(HIGH_VALUE);

let getRequestAtendiendose = (tps, n) =>
  lazy(tps)
    .take(n * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES)
    .filter((x) => x !== HIGH_VALUE);

let getCantidadRequestAtendiendose = (tps, n) => getRequestAtendiendose(tps, n).size();

let hayQueVaciar = (tps, n) => !getRequestAtendiendose(tps, n).isEmpty();

let run = (minimo_servidores, maximo_servidores, req_max_esperando) => {

  let CANTIDAD_WORKERS_ACTIVOS = minimo_servidores;
  let MAX_CANTIDAD_WORKERS_ACTIVOS = minimo_servidores;
  let MIN_CANTIDAD_WORKERS_ACTIVOS = minimo_servidores;
  let CANTIDAD_REQUESTS = 0;
  let TIEMPO = 0;
  let TPLL = 0;
  let TPS = initArray(MAXIMA_CANTIDAD_REQUEST_CONCURRENTES * maximo_servidores, HIGH_VALUE);

  let cantidad_encendidos = 0;
  let costo_por_requests = 0;
  let sumatoria_tiempos_atencion = 0;
  let sumatoria_llegadas = 0;
  let sumatoria_salidas = 0;
  let total_request_procesados = 0;

  var tiempo_encendido_servidor = initArray(maximo_servidores, 0);
  var tiempo_acumulado_servidor = initArray(maximo_servidores, 0);

  function printResults() {

    let costo_tiempo = 0;
    for (let i = 0; i < MAX_CANTIDAD_WORKERS_ACTIVOS; i++) {
      costo_tiempo = costo_tiempo + tiempo_acumulado_servidor[i] * COSTO_EQUIPO;
    }

    let costo_total = costo_por_requests + COSTO_FIREBASE * MONTHS + cantidad_encendidos * COSTO_ENCENDIDO + costo_tiempo;
    let prom_costo_mensual = costo_total / MONTHS;
    let prom_espera = Math.abs((sumatoria_salidas - sumatoria_llegadas - sumatoria_tiempos_atencion) / TIEMPO);
    let prom_respuesta = Math.abs((sumatoria_salidas - sumatoria_llegadas) / TIEMPO);

    console.log('');
    console.log('==============================================================================');
    console.log('');
    console.log("Cantidad mínima de workers:", minimo_servidores);
    console.log("Cantidad máximo de workers:", maximo_servidores);
    console.log("Cantidad máxima de request en cola antes de levantar otro worker:", req_max_esperando);
    console.log('');
    console.log("Cantidad mínima de workers levantados:", MIN_CANTIDAD_WORKERS_ACTIVOS);
    console.log("Cantidad máxima de workers levantados:", MAX_CANTIDAD_WORKERS_ACTIVOS);
    console.log('');
    console.log("Promedio de costo mensual:", prom_costo_mensual.toFixed(2), "U$S");
    console.log("Promedio de espera de un request:", prom_espera.toFixed(0), "ms");
    console.log("Promedio de tiempo de respuest:", prom_respuesta.toFixed(0), "ms");
    console.log('');
    console.log('==============================================================================');
    console.log('');
  }

  ['SIGINT', 'SIGTERM'].forEach(function (signal) {
    process.on(signal, function () {
      printResults();
      process.exit(1);
    });
  });

  while (TIEMPO <= TIEMPO_FINAL) {

    let menor_salida = getMenorTPS(TPS, CANTIDAD_WORKERS_ACTIVOS);
    log('Menor TPS', menor_salida);

    if (TPLL <= TPS[menor_salida]) { // LLEGADA

      CANTIDAD_REQUESTS ++;

      TIEMPO = TPLL;
      log('[LLEGADA] Avanzo hasta', TIEMPO);

      let INTERVALO_ENTRE_REQUEST = getIntervaloArribos();
      TPLL = TIEMPO + INTERVALO_ENTRE_REQUEST;

      if (CANTIDAD_REQUESTS <= CANTIDAD_WORKERS_ACTIVOS * MAXIMA_CANTIDAD_REQUEST_CONCURRENTES) {

        let req_esperando = CANTIDAD_REQUESTS - getCantidadRequestAtendiendose(TPS, MAXIMA_CANTIDAD_REQUEST_CONCURRENTES) - 1;

        if (req_esperando === req_max_esperando) {

          if (CANTIDAD_WORKERS_ACTIVOS < maximo_servidores) {

            CANTIDAD_WORKERS_ACTIVOS++;
            console.log('Prendiendo un equipo... ', CANTIDAD_WORKERS_ACTIVOS);
            MAX_CANTIDAD_WORKERS_ACTIVOS = Math.max(CANTIDAD_WORKERS_ACTIVOS, MAX_CANTIDAD_WORKERS_ACTIVOS);
            MIN_CANTIDAD_WORKERS_ACTIVOS = Math.min(CANTIDAD_WORKERS_ACTIVOS, MIN_CANTIDAD_WORKERS_ACTIVOS);

            let cantidad_de_request_a_atender = Math.min(req_esperando, MAXIMA_CANTIDAD_REQUEST_CONCURRENTES);

            for (let i = 0; i < cantidad_de_request_a_atender; i++) {
              let libre = getPuestoLibre(TPS, CANTIDAD_WORKERS_ACTIVOS);
              let TAMANIO_ARCHIVO = getTamanioArchivo();
              let atencion = getAtencion(TAMANIO_ARCHIVO);
              TPS[libre] = TIEMPO + atencion.tiempo;
              sumatoria_tiempos_atencion = sumatoria_tiempos_atencion + atencion.tiempo;
              costo_por_requests = costo_por_requests + atencion.costo;
            }

            cantidad_encendidos ++;
            tiempo_encendido_servidor[CANTIDAD_WORKERS_ACTIVOS - 1] = TIEMPO;

          }

        }

      } else {

        let libre = getPuestoLibre(TPS, CANTIDAD_WORKERS_ACTIVOS);
        let TAMANIO_ARCHIVO = getTamanioArchivo();
        let atencion = getAtencion(TAMANIO_ARCHIVO);
        TPS[libre] = TIEMPO + atencion.tiempo;
        sumatoria_tiempos_atencion = sumatoria_tiempos_atencion + atencion.tiempo;

        sumatoria_llegadas = sumatoria_llegadas + TIEMPO;
        costo_por_requests = costo_por_requests + atencion.costo;

      }

    } else { // SALIDA

      CANTIDAD_REQUESTS --;

      TIEMPO = TPS[menor_salida];
      log('[SALIDA] Avanzo hasta', TIEMPO);

      if (estaVacioWorker(menor_salida, TPS, CANTIDAD_WORKERS_ACTIVOS)) {
        CANTIDAD_WORKERS_ACTIVOS --;
        console.log('Apagando un equipo... ', CANTIDAD_WORKERS_ACTIVOS);
        MAX_CANTIDAD_WORKERS_ACTIVOS = Math.max(CANTIDAD_WORKERS_ACTIVOS, MAX_CANTIDAD_WORKERS_ACTIVOS);
        MIN_CANTIDAD_WORKERS_ACTIVOS = Math.min(CANTIDAD_WORKERS_ACTIVOS, MIN_CANTIDAD_WORKERS_ACTIVOS);
        const numero_worker = getNumeroWorker(menor_salida);
        tiempo_acumulado_servidor[numero_worker] = TIEMPO - tiempo_encendido_servidor[numero_worker];
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
      total_request_procesados ++;

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

  printResults();

  process.exit(0);

};

rl.question('Cantidad de workers mínimo? ', (min) => {
  rl.question('Cantidad de workers máximo? ', (max) => {
    rl.question('Cantidad máxima de request en cola antes de levantar otro worker? ', (max_cola) => {
      run(parseInt(min), parseInt(max), parseInt(max_cola));
    });
  });
});

