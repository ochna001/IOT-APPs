import * as Paho from 'paho-mqtt';

const MQTT_BROKER = 'broker.hivemq.com';
const MQTT_PORT = 8884;
const MQTT_CLIENT_ID = 'iot-app-' + Math.random().toString(16).substr(2, 8);

let client = null;
let isConnected = false;
let isConnecting = false;
let subscriptionQueue = [];
let messageHandlers = [];

const processSubscriptionQueue = () => {
  if (isConnected && client) {
    subscriptionQueue.forEach(topic => {
      console.log(`Processing queued subscription for topic: ${topic}`);
      try {
        client.subscribe(topic);
      } catch (err) {
        console.error(`Error subscribing to ${topic}:`, err);
      }
    });
    subscriptionQueue = [];
  }
};

const connect = () => {
  if (isConnected || isConnecting || client) {
    console.log('MQTT: Already connected or connecting');
    return;
  }

  isConnecting = true;
  client = new Paho.Client(MQTT_BROKER, MQTT_PORT, MQTT_CLIENT_ID);

  client.onConnectionLost = (responseObject) => {
    if (responseObject.errorCode !== 0) {
      console.log('MQTT connection lost:', responseObject.errorMessage);
      isConnected = false;
      isConnecting = false;
    }
  };

  client.onMessageArrived = (message) => {
    messageHandlers.forEach(handler => {
      try {
        handler(message.topic, message.payloadString);
      } catch (err) {
        console.error('Error in message handler:', err);
      }
    });
  };

  client.connect({
    useSSL: true,
    onSuccess: () => {
      console.log('MQTT connected successfully');
      isConnected = true;
      isConnecting = false;
      processSubscriptionQueue();
    },
    onFailure: (err) => {
      console.log('MQTT connection failed:', err.errorMessage);
      isConnecting = false;
      client = null;
    },
  });
};

export const initMQTT = (onMessageArrived) => {
  if (onMessageArrived && !messageHandlers.includes(onMessageArrived)) {
    messageHandlers.push(onMessageArrived);
  }
  connect();
};

export const subscribeToTopic = (topic) => {
  if (!topic) return;
  
  if (isConnected && client) {
    console.log(`Subscribing to topic: ${topic}`);
    try {
      client.subscribe(topic);
    } catch (err) {
      console.error(`Error subscribing to ${topic}:`, err);
    }
  } else {
    console.log(`Queueing subscription for topic: ${topic}`);
    if (!subscriptionQueue.includes(topic)) {
      subscriptionQueue.push(topic);
    }
    if (!isConnecting && !client) {
      connect();
    }
  }
};

export const unsubscribeFromTopic = (topic) => {
  if (!topic) return;
  
  if (isConnected && client) {
    console.log(`Unsubscribing from topic: ${topic}`);
    try {
      client.unsubscribe(topic);
    } catch (err) {
      console.error(`Error unsubscribing from ${topic}:`, err);
    }
  }
};
