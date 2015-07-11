/* jshint node: true, esnext: true */
'use strict';

var _ = require('lodash');
var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var ms_mes = () => 1000 * 60 * 60 * 24 * 30;

var salir = () => process.exit(0);

var initArray = function(n, value) {
  var result = [];
  for (var i = 0; i < n; i++) {
    result.push(value);
  }
  return result;
};

var log = (message) => console.info(message);

var menor_tps = function(tps, n) {
  var min_index = 0;
  _(tps)
    .take(n * REQ_MAX_SER)
    .forEach(function(value, index) {
      if (value < tps[min_index]) {
        min_index = index;
      }
    });
  return min_index;
};

var intervalo_arribos = function() {
  var x = Math.random();
  var y = Math.pow(1 / Math.pow(x, 3.07759) - 1, 0.51182);

  if (isNaN(y) || y < 0) {
    throw new Error(y);
  }
  return y;
};

var tiempo_atencion_estatico = function() {
  var x = Math.random();
  var y = Math.pow(1 / Math.pow(x, 3.07759) - 1, 0.51182);

  if (isNaN(y) || y < 0) {
    throw new Error(y);
  }
  return y + 15000;
};

var tiempo_atencion_dinamico = function() {
  var x = Math.random();
  var y = Math.pow(1 / Math.pow(x, 3.07759) - 1, 0.51182);

  if (isNaN(y) || y < 0) {
    throw new Error(y);
  }
  return y + 40000;
};

var demora_encendido = function() {
  var x = Math.random();
  var y = Math.pow(1 / Math.pow(x, 3.07759) - 1, 0.51182);

  if (isNaN(y) || y < 0) {
    throw new Error(y);
  }
  return y + 20000;
};

var servidor_vacio = function(menor_salida, tps, n) {
  var equipo = numero_equipo(menor_salida);
  _(tps)
    .rest(equipo * REQ_MAX_SER)
    .take(REQ_MAX_SER)
    .every(function(e) {
      return e === HV;
    });
};

var numero_equipo = function(thread) {
  return Math.floor(thread / REQ_MAX_SER);
};

var rechaza_request = function(reqs, tps, n, req_max_esperando) {
  return reqs - reqs_atendiendose(tps, n) > req_max_esperando;
};

var puesto_libre = function(tps, n) {
  return _(tps)
    .take(n * REQ_MAX_SER)
    .findIndex(function(value) {
      return value === HV;
    });
};

var reqs_atendiendose = function(tps, n) {
  return _(tps)
    .take(n * REQ_MAX_SER)
    .filter(function(x) {
      return x !== HV;
    })
    .value()
    .length;
};

var alguien_pendiente = function(tps, n) {
  return reqs_atendiendose(tps, n) !== 0;
};

/**
 * CONSTANTES
 */
var REQ_MAX_SER = 100;
var PORC_TIPO_ESTATICO = 0.8;
var TF = 1000 * ms_mes();
var HV = Number.MAX_VALUE;
var COSTO_EQUIPO = 250 / ms_mes();
var COSTO_ENCENDIDO = 1;

rl.question('Numero de servidores minimos? ', function(n_min) {
  rl.question('Numero servidores maximos? ', function(n_max) {
    rl.question('Numero maximo de request esperando para prender un equipo? ', function(max_espera) {
      run(parseInt(n_min), parseInt(n_max), parseInt(max_espera));
    });
  });
});

var run = (minimo_servidores, maximo_servidores, req_max_esperando) => {
  var n = minimo_servidores;
  var reqs = 0;
  var t = 0;
  var tpll = 0;
  var tps = initArray(REQ_MAX_SER * maximo_servidores, HV);

  var request_recibidas = 0;
  var request_rechazadas = 0;

  var sta = 0;
  var cantidad_encendidos = 0;
  var sum_llegadas = 0;
  var sum_salidas = 0;
  var tiempo_encendido_servidor = initArray(maximo_servidores, 0);
  var tiempo_acumulado_servidor = initArray(maximo_servidores, 0);

  var ta, i, libre;
  var j = 0;
  do {
    j++;
    var menor_salida = menor_tps(tps, n);

    log('menor tps ' + menor_salida);

    if (tpll <= tps[menor_salida]) { // Llegada
      //Avanzo T
      t = tpll;
      log('[LLEGADA] Avanzo hasta ' + t);

      // EFNC
      var ia = intervalo_arribos();
      tpll = t + ia;

      var rechaza = rechaza_request(reqs, tps, n, req_max_esperando);
      request_recibidas = request_recibidas + 1;

      if (!rechaza) {
        // actualizacion vector de estado
        reqs = reqs + 1;
        //console.log('[REQS] ' + reqs );

        var req_esperando = reqs - reqs_atendiendose(tps, n) - 1;
        //console.log('[REQS_ESPERANDO] ' + req_esperando );

        if (req_esperando === req_max_esperando) {
          if (n < maximo_servidores) {
            n = n + 1;
            console.log('prendiendo un equipo... ' + n);

            // EFC
            for (i = 0; i < Math.min(req_esperando, REQ_MAX_SER); i++) {
              libre = puesto_libre(tps, n);
              if (Math.random() < PORC_TIPO_ESTATICO) {
                ta = tiempo_atencion_estatico();
              } else {
                ta = tiempo_atencion_dinamico();
              }
              tps[libre] = t + ta + demora_encendido();
              sta = sta + ta;
            }

            cantidad_encendidos = cantidad_encendidos + 1;
            tiempo_encendido_servidor[n - 1] = t;
          }

        } else {
          // EFC
          if (reqs <= n * REQ_MAX_SER) {
            libre = puesto_libre(tps, n);
            if (Math.random() < PORC_TIPO_ESTATICO) {
              ta = tiempo_atencion_estatico();
            } else {
              ta = tiempo_atencion_dinamico();
            }
            tps[libre] = t + ta;
            sta = sta + ta;
          }
        }

        sum_llegadas = sum_llegadas + t;
      } else {
        request_rechazadas = request_rechazadas + 1;
      }

    } else { // Salida
      t = tps[menor_salida];

      log('[SALIDA] Avanzo hasta ' + t);

      //Actualizo vector estado
      reqs = reqs - 1;
      if (servidor_vacio(menor_salida, tps, n)) {
        n = n - 1;
        console.log('apagando un equipo... ' + n);
        tiempo_acumulado_servidor[numero_equipo(menor_salida)] = t - tiempo_encendido_servidor(numero_equipo(menor_salida));
      }

      // EFC
      if (reqs >= n * REQ_MAX_SER) {
        if (Math.random() < PORC_TIPO_ESTATICO) {
          ta = tiempo_atencion_estatico();
        } else {
          ta = tiempo_atencion_dinamico();
        }
        sta = sta + ta;
        tps[menor_salida] = t + ta;
      } else {
        tps[menor_salida] = HV;
      }
      sum_salidas = sum_salidas + t;
    }
  } while (t <= TF || (t > TF && alguien_pendiente(tps, n)));

  var costo_tiempo = 0;
  for (i = 0; i < maximo_servidores; i++) {
    costo_tiempo = costo_tiempo + tiempo_acumulado_servidor[i] * COSTO_EQUIPO;
  }
  var costo_total = (cantidad_encendidos * COSTO_ENCENDIDO) + costo_tiempo;

  var prom_costo = costo_total / (TF/ms_mes());
  var porc_req_rechazadas = request_rechazadas * 100 / request_recibidas;
  var prom_espera = (sum_salidas - sum_llegadas - sta) / (request_recibidas - request_rechazadas);
  var prom_respuesta = (sum_salidas - sum_llegadas) / (request_recibidas - request_rechazadas);

  log(sum_salidas);
  log(sum_llegadas);
  log(sta);

  console.log('\n====================================================');
  console.log("Cantidad minima servidores " + minimo_servidores);
  console.log("Cantidad maxima servidores " + maximo_servidores);
  console.log("Cantidad reqs esperando maxima para prender un equipo " + req_max_esperando);

  console.log("Promedio de costo mensual " + prom_costo);
  console.log("Porcentaje de req. rechazados " + porc_req_rechazadas);
  console.log("Promedio de espera de un request " + prom_espera);
  console.log("Promedio de tiempo de respuesta " + prom_respuesta);

  salir();
};
