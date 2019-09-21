﻿import {Inbound} from '../Messages';
import {ControllerType} from '../../../Constants';
import {state, BodyTempState, SF} from '../../../State';
import {sys, Body, PF} from '../../../Equipment';
import {logger} from 'logger/Logger';

export class EquipmentStateMessage {
  public static process(msg: Inbound) {
    if (sys.controllerType === ControllerType.Unknown) {
      if (msg.action !== 2) return;
      const model1 = msg.extractPayloadByte(27);
      switch (model1) {
        case 23: // IntelliCenter
          PF.controllerType = ControllerType.IntelliCenter;
          SF.controllerType = ControllerType.IntelliCenter;
          // let EquipmentMessage handle maxValves, Circuits, etc
          break;
        case 11: // SunTouch.  Eq to IntelliCom??
          break;
        case 0: // IntelliTouch i5
        case 1: // IntelliTouch i7+3
        case 2: // IntelliTouch i9+3
        case 3: // IntelliTouch i5+3S
        case 4: // IntelliTouch i9+3S
        case 5: // IntelliTouch i10+3D
        case 13: // EasyTouch2 Models
        case 14: // EasyTouch1 Models
          PF.controllerType = ControllerType.IntelliTouch;
          SF.controllerType = ControllerType.IntelliTouch;
          break;
                // IntelliCom?
      }
      EquipmentStateMessage.processEquipmentState(msg);
      return;
    }
    const ndx = 0;
    switch (msg.action) {
      case 2:
        // Shared
        const dt = new Date();
        state.time.hours = msg.extractPayloadByte(0);
        state.time.minutes = msg.extractPayloadByte(1);
        state.time.seconds = dt.getSeconds();

        state.mode = msg.extractPayloadByte(9) & 0x81;
        state.temps.units = msg.extractPayloadByte(9) & 0x04;
        state.valve = msg.extractPayloadByte(10);
        // EquipmentStateMessage.processHeatStatus(msg.extractPayloadByte(11));

        // state.heatMode = msg.extractPayloadByte(11);
        state.delay = msg.extractPayloadByte(12);

        if (msg.controllerType === ControllerType.IntelliCenter) {
          state.temps.waterSensor1 = msg.extractPayloadByte(14) + sys.general.options.waterTempAdj1;
          if (sys.bodies.length > 2)
            state.temps.waterSensor2 = msg.extractPayloadByte(15) + sys.general.options.waterTempAdj2;
          // We are making an assumption here in that the circuits are always labeled the same.
          // 1=Spa
          // 6=Pool
          // 12=Body3
          // 22=Body4 -- Really not sure about this one.
          if (sys.bodies.length > 0) {
            // We will not go in here if this is not a shared body.
            const tbody: BodyTempState = state.temps.bodies.getItemById(1, true);
            const cbody: Body = sys.bodies.getItemById(1);
            tbody.heatMode = cbody.heatMode;
            tbody.setPoint = cbody.setPoint;
            tbody.name = cbody.name;
            tbody.circuit = 6;
            tbody.heatStatus = msg.extractPayloadByte(11) & 0x0f;
            if ((msg.extractPayloadByte(2) & 0x20) === 32) {
              tbody.temp = state.temps.waterSensor1;
              tbody.isOn = true;
            } else tbody.isOn = false;
          }
          if (sys.bodies.length > 1) {
            const tbody: BodyTempState = state.temps.bodies.getItemById(2, true);
            const cbody: Body = sys.bodies.getItemById(2);
            tbody.heatMode = cbody.heatMode;
            tbody.setPoint = cbody.setPoint;
            tbody.name = cbody.name;
            tbody.circuit = 1;
            tbody.heatStatus = (msg.extractPayloadByte(11) & 0xf0) >> 4;
            if ((msg.extractPayloadByte(2) & 0x01) === 1) {
              tbody.temp = state.temps.waterSensor1;
              tbody.isOn = true;
            } else tbody.isOn = false;
          }
          if (sys.bodies.length > 2) {
            const tbody: BodyTempState = state.temps.bodies.getItemById(3, true);
            const cbody: Body = sys.bodies.getItemById(3);
            tbody.name = cbody.name;
            tbody.heatMode = cbody.heatMode;
            tbody.setPoint = cbody.setPoint;
            tbody.heatStatus = msg.extractPayloadByte(11) & 0x0f;
            tbody.circuit = 12;
            if ((msg.extractPayloadByte(3) & 0x08) === 8) {
              // This is the first circuit on the second body.
              tbody.temp = state.temps.waterSensor2;
              tbody.isOn = true;
            } else tbody.isOn = false;
          }
          if (sys.bodies.length > 3) {
            const tbody: BodyTempState = state.temps.bodies.getItemById(4, true);
            const cbody: Body = sys.bodies.getItemById(4);
            tbody.name = cbody.name;
            tbody.heatMode = cbody.heatMode;
            tbody.setPoint = cbody.setPoint;
            tbody.heatStatus = (msg.extractPayloadByte(11) & 0xf0) >> 4;
            tbody.circuit = 22;
            if ((msg.extractPayloadByte(5) & 0x20) === 32) {
              // This is the first circuit on the third body or the first circuit on the second expansion.
              tbody.temp = state.temps.waterSensor2;
              tbody.isOn = true;
            } else tbody.isOn = false;
          }
          state.temps.air = msg.extractPayloadByte(18) + sys.general.options.airTempAdj; // 18
          state.temps.solar = msg.extractPayloadByte(19) + sys.general.options.solarTempAdj1; // 19
          // todo: do not think this is correct - at least not for IntelliTouch
          state.adjustDST = (msg.extractPayloadByte(23) & 0x01) === 0x01; // 23
        } else if (msg.controllerType === ControllerType.IntelliTouch) {
          state.temps.waterSensor1 = msg.extractPayloadByte(14);
          if (sys.bodies.length > 2) state.temps.waterSensor2 = msg.extractPayloadByte(15);
          if (sys.bodies.length > 0) {
            const tbody: BodyTempState = state.temps.bodies.getItemById(1, true);
            const cbody: Body = sys.bodies.getItemById(1);
            if ((msg.extractPayloadByte(2) & 0x20) === 32) {
              tbody.temp = state.temps.waterSensor1;
              tbody.isOn = true;
            } else tbody.isOn = false;
            tbody.setPoint = cbody.setPoint;
            tbody.name = cbody.name;
            tbody.circuit = 6;
            const heatMode = msg.extractPayloadByte(22) & 0x03;
            tbody.heatMode = heatMode;
            cbody.heatMode = heatMode;
            if (tbody.isOn) {
              const byte = msg.extractPayloadByte(10);
              if ((byte & 0x0c) >> 2 === 3) tbody.heatStatus = 1; // Heater
              else if ((byte & 0x30) >> 4 === 3) tbody.heatStatus = 2; // Solar
            } else
              tbody.heatStatus = 0; // Off
          }
          if (sys.bodies.length > 1) {
            const tbody: BodyTempState = state.temps.bodies.getItemById(2, true);
            const cbody: Body = sys.bodies.getItemById(2);
            if ((msg.extractPayloadByte(2) & 0x01) === 1) {
              tbody.temp = state.temps.waterSensor2;
              tbody.isOn = true;
            } else tbody.isOn = false;
            const heatMode = (msg.extractPayloadByte(22) & 0x0c) >> 2;
            tbody.heatMode = heatMode;
            cbody.heatMode = heatMode;
            tbody.setPoint = cbody.setPoint;
            tbody.name = cbody.name;
            tbody.circuit = 1;
            if (tbody.isOn) {
              const byte = msg.extractPayloadByte(10);
              if ((byte & 0x0c) >> 2 === 3) tbody.heatStatus = 1; // Heater
              else if ((byte & 0x30) >> 4 === 3) tbody.heatStatus = 2; // Solar
            } else
              tbody.heatStatus = 0; // Off
          }
        }
        EquipmentStateMessage.processCircuitState(msg);
        EquipmentStateMessage.processFeatureState(msg);
        EquipmentStateMessage.processEquipmentState(msg);
        state.emitControllerChange();
        break;
      case 5: // Intellitouch only.  Date/Time packet
        // [255,0,255][165,1,15,16,5,8][15,10,8,1,8,18,0,1][1,15]
        state.time.date = msg.extractPayloadByte(3);
        state.time.month = msg.extractPayloadByte(4);
        state.time.year = msg.extractPayloadByte(5);
        sys.general.options.adjustDST = state.adjustDST =
                    msg.extractPayloadByte(7) === 0x01;
        // defaults
        sys.general.options.clockMode = 12;
        sys.general.options.clockSource = 'manual';
        break;
      case 8: // IntelliTouch only.  Heat status
        // [165,x,15,16,8,13],[75,75,64,87,101,11,0, 0 ,62 ,0 ,0 ,0 ,0] ,[2,190]
        state.temps.waterSensor1 = msg.extractPayloadByte(0);
        if (sys.bodies.length > 1)
          state.temps.waterSensor2 = msg.extractPayloadByte(1);
        state.temps.air = msg.extractPayloadByte(2);
        state.temps.solar = msg.extractPayloadByte(8);
        if (sys.bodies.length > 0) {
          // pool
          // We will not go in here is this is not a shared body.
          const tbody: BodyTempState = state.temps.bodies.getItemById(1, true);
          const cbody: Body = sys.bodies.getItemById(1);
          tbody.heatMode = cbody.heatMode = msg.extractPayloadByte(5) & 3;
          tbody.setPoint = cbody.setPoint = msg.extractPayloadByte(3);
          tbody.name = cbody.name;
          tbody.circuit = 6;
          tbody.heatStatus = msg.extractPayloadByte(11) & 0x0f;
          if ((msg.extractPayloadByte(2) & 0x20) === 32) {
            tbody.temp = state.temps.waterSensor1;
            tbody.isOn = true;
          } else tbody.isOn = false;
        }
        if (sys.bodies.length > 1) {
          // spa
          const tbody: BodyTempState = state.temps.bodies.getItemById(2, true);
          const cbody: Body = sys.bodies.getItemById(2);
          tbody.heatMode = cbody.heatMode =
                        (msg.extractPayloadByte(5) & 12) >> 2;
          tbody.setPoint = cbody.setPoint = msg.extractPayloadByte(4);
          tbody.name = cbody.name;
          tbody.circuit = 1;
          tbody.heatStatus = (msg.extractPayloadByte(11) & 0xf0) >> 4;
          if ((msg.extractPayloadByte(2) & 0x01) === 1) {
            tbody.temp = state.temps.waterSensor1;
            tbody.isOn = true;
          } else tbody.isOn = false;
        }
        break;
      case 96:
        EquipmentStateMessage.processIntelliBriteMode(msg);
        break;
      case 204: // IntelliCenter only.
        state.batteryVoltage = msg.extractPayloadByte(2) / 50;
        state.comms.keepAlives = msg.extractPayloadInt(4);
        state.time.date = msg.extractPayloadByte(6);
        state.time.month = msg.extractPayloadByte(7);
        state.time.year = msg.extractPayloadByte(8);
        if (msg.extractPayloadByte(37, 255) !== 255) {
          const chlor = state.chlorinators.getItemById(1);
          chlor.superChlorRemaining =
                        msg.extractPayloadByte(37) * 3600 + msg.extractPayloadByte(38) * 60;
          chlor.emitEquipmentChange();
        } else {
          const chlor = state.chlorinators.getItemById(1);
          chlor.superChlorRemaining = 0;
          chlor.superChlor = false;
          chlor.emitEquipmentChange();
        }
        EquipmentStateMessage.processEquipmentState();
        state.emitControllerChange();
        break;
    }
  }
  private static processEquipmentState(msg?: Inbound) {
    // defaults; set to lowest possible values
    sys.equipment.maxBodies = 1;
    sys.equipment.maxCircuits = 4;
    sys.equipment.shared = false;
    sys.equipment.maxChlorinators = 1;
    sys.equipment.maxSchedules = 12;
    sys.equipment.maxPumps = 2;
    sys.equipment.maxSchedules = 12;
    sys.equipment.maxValves = 2;
    if (sys.controllerType === ControllerType.IntelliTouch) {
      const model1 = msg.extractPayloadByte(27);
      const model2 = msg.extractPayloadByte(28);
      switch (model2) {
        case 23: // IntelliCenter
          // let EquipmentMessage handle maxValves, Circuits, etc
          sys.equipment.maxSchedules = 100;
          sys.equipment.maxFeatures = 32;
          sys.equipment.maxChlorinators = 2;
          sys.equipment.maxPumps = 16;
          break;
        case 11: // SunTouch.  Eq to IntelliCom??
          break;
        case 0: // IntelliTouch i5+3
          sys.equipment.model = 'IntelliTouch i5+3S';
          sys.equipment.shared = true;
          sys.equipment.maxBodies = 2;
          sys.equipment.maxValves = 3;
          sys.equipment.maxSchedules = 99;
          sys.equipment.maxCircuits = 6; // 2 filter + 5 aux
        case 1: // IntelliTouch i7+3
          sys.equipment.model = 'IntelliTouch i7+3';
          sys.equipment.shared = true;
          sys.equipment.maxBodies = 2;
          sys.equipment.maxValves = 3;
          sys.equipment.maxSchedules = 99;
          sys.equipment.maxCircuits = 7; // 2 filter + 5 aux
        case 2: // IntelliTouch i9+3
          sys.equipment.model = 'IntelliTouch i9+3';
          sys.equipment.shared = true;
          sys.equipment.maxBodies = 2;
          sys.equipment.maxValves = 3;
          sys.equipment.maxSchedules = 99;
          sys.equipment.maxCircuits = 9; // 1 filter + 8 aux
        case 3: // IntelliTouch i5+3S
          sys.equipment.model = 'IntelliTouch i5+3S';
          sys.equipment.maxValves = 3;
          sys.equipment.maxSchedules = 99;
          sys.equipment.maxCircuits = 5; // 2 filter + 8 aux
        case 4: // IntelliTouch i9+3S
          sys.equipment.model = 'IntelliTouch i9+3S';
          sys.equipment.maxValves = 3;
          sys.equipment.maxSchedules = 99;
          sys.equipment.maxCircuits = 9; // 1 filter + 8 aux
        case 5: // IntelliTouch i10+3D
          sys.equipment.model = 'IntelliTouch i10+3D';
          sys.equipment.maxBodies = 2;
          sys.equipment.maxValves = 3;
          sys.equipment.maxSchedules = 99;
          sys.equipment.maxCircuits = 10; // 2 filter + 8 aux
        case 13: // EasyTouch2 Models
          switch (model1) {
            case 0:
              sys.equipment.model = 'EasyTouch2 8';
              sys.equipment.shared = true;
              sys.equipment.maxBodies = 2;
              sys.equipment.maxCircuits = 8;
              // max features??
              break;
            case 1:
              sys.equipment.model = 'EasyTouch2 8P';
              sys.equipment.maxCircuits = 8;
              // max features??
              break;
            case 2:
              sys.equipment.model = 'EasyTouch2 4';
              sys.equipment.shared = true;
              sys.equipment.maxBodies = 2;
              // max features??
              break;
            case 3:
              sys.equipment.model = 'EasyTouch2 4P';
              // max features??
              break;
          }
          break;

        case 14: // EasyTouch1 Models
          switch (model1) {
            case 0:
              sys.equipment.model = 'EasyTouch1 8';
              sys.equipment.shared = true;
              sys.equipment.maxBodies = 2;
              sys.equipment.maxValves = 2;
              sys.equipment.maxCircuits = 8;
              // max features??
              break;
            case 1:
              sys.equipment.model = 'EasyTouch1 8P';
              sys.equipment.maxBodies = 1;
              sys.equipment.maxValves = 2;
              sys.equipment.maxCircuits = 8;
              // max features??
              break;
            case 2: // check...
              sys.equipment.model = 'EasyTouch1 4';
              sys.equipment.shared = true;
              sys.equipment.maxBodies = 2;
              sys.equipment.maxValves = 2;
              sys.equipment.maxCircuits = 4;
              // max features??
              break;
            case 3: // check...
              sys.equipment.model = 'EasyTouch1 4P';
              sys.equipment.maxValves = 2;
              sys.equipment.maxCircuits = 4;
              // max features??
              break;
          }
          break;
      }
      // state.equipment.model = sys.equipment.model;
      // state.equipment.maxBodies = sys.equipment.maxBodies;
      // state.equipment.maxCircuits = sys.equipment.maxCircuits;
      // state.equipment.maxValves = sys.equipment.maxValves;
      // state.equipment.maxSchedules = sys.equipment.maxSchedules;
      // state.equipment.shared = sys.equipment.shared;
      // state.emitControllerChange();
    }
  }
  private static processFeatureState(msg: Inbound) {
    // Somewhere in this packet we need to find support for 32 bits of features.
    // Turning on the first defined feature set by 7 to 16
    // Turning on the second defined feature set byte 7 to 32
    // This means that the first 4 feature circuits are located at byte 7 on the 4 most significant bits.  This leaves 28 bits
    // unaccounted for when it comes to a total of 32 features.

    // We do know that the first 6 bytes are accounted for so byte 8, 10, or 11 are potential candidates.
    switch (sys.controllerType) {
      case ControllerType.IntelliCenter:
        for (let i = 1; i <= sys.features.length; i++)
        // Use a case statement here since we don't know where to go after 4.
          switch (i) {
            case 1:
            case 2:
            case 3:
            case 4:
              const byte = msg.extractPayloadByte(7);
              const feature = sys.features.getItemById(i);
              const fstate = state.features.getItemById(i, feature.isActive);
              fstate.isOn = (byte >> 4 & 1 << (i - 1)) > 0;
              fstate.emitEquipmentChange();
              fstate.name = feature.name;
              break;
          }

        break;
      case ControllerType.IntelliTouch:
        const count = Math.min(Math.floor(sys.features.length / 8), 5) + 12;
        let featureId = 9;
        for (let i = 3; i < msg.payload.length && i <= count; i++) {
          const byte = msg.extractPayloadByte(i);
          // Shift each bit getting the circuit identified by each value.
          for (let j = 0; j < 8; j++) {
            const feature = sys.features.getItemById(featureId);
            if (feature.isActive) {
              const fstate = state.features.getItemById(
                  featureId,
                  feature.isActive
              );
              fstate.isOn = (byte & 1 << j) >> j > 0;
              fstate.name = feature.name;
              fstate.emitEquipmentChange();
            }
            featureId++;
          }
        }
        break;
    }
  }
  private static processCircuitState(msg: Inbound) {
    // The way this works is that there is one byte per 8 circuits for a total of 5 bytes or 40 circuits.  The
    // configuration already determined how many available circuits we have by querying the model of the panel
    // and any installed expansion panel models.  Only the number of available circuits will appear in this
    // array.
    const count = Math.min(Math.floor(sys.circuits.length / 8), 5) + 2;
    let circuitId = 1;
    let body = 0; // Off
    for (let i = 2; i < msg.payload.length && i <= count; i++) {
      const byte = msg.extractPayloadByte(i);
      // Shift each bit getting the circuit identified by each value.
      for (let j = 0; j < 8; j++) {
        const circuit = sys.circuits.getItemById(circuitId);
        if (circuit.isActive) {
          const cstate = state.circuits.getItemById(circuitId, circuit.isActive);
          cstate.isOn = (byte & 1 << j) >> j > 0;
          cstate.name = circuit.name;
          cstate.showInFeatures = circuit.showInFeatures;
          cstate.type = circuit.type;
          if (cstate.isOn && circuitId === 6) body = 6;
          if (cstate.isOn && circuitId === 1) body = 1;
          if (sys.controllerType === ControllerType.IntelliCenter)
          // intellitouch sends a separate msg with themes
            switch (circuit.type) {
              case 6: // Globrite
              case 5: // Magicstream
              case 8: // Intellibrite
              case 10: // Colorcascade
                cstate.lightingTheme = circuit.lightingTheme;
                break;
              case 9:
                cstate.level = circuit.level;
                break;
            }
          cstate.emitEquipmentChange();
        }
        circuitId++;
      }
    }
    state.body = body;
  }
  private static processIntelliBriteMode(msg: Inbound) {
    // eg RED: [165,16,16,34,96,2],[195,0],[2,12]
    // data[0] = color
    const color = msg.extractPayloadByte(0);
    for (let i = 0; i <= sys.intellibrite.length; i++) {
      const ib = sys.intellibrite.getItemByIndex(i);
      const cstate = state.circuits.getItemById(ib.id, true);
      const circuit = sys.circuits.getItemById(ib.id, true);
      switch (color) {
        case 0: // off
        case 1: // on
        case 190: // save
        case 191: // recall
          break;
        case 160: // color set (pre-defined colors)
          cstate.lightingTheme = circuit.lightingTheme = ib.colorSet;
          break;
        default:
          // intellibrite themes
          cstate.lightingTheme = circuit.lightingTheme = color;
          break;
      }
    }
  }
}