var ships = {
  'warbird': {
    accel: 20,
    maxspeed: 800,
    turnspeed: 8,
    maxenergy: 250,
    bulletenergyuse: 200,
    bulletlifetime: 100,
    bulletdamage: 300,
    bulletspeed: 1800,
    recharge: 2,
    reload: 30,
    abilitycd: 220
  },
  'lancaster': {
    accel: 16,
    maxspeed: 720,
    turnspeed: 6,
    maxenergy: 250,
    bulletenergyuse: 75,
    bulletlifetime: 60,
    bulletdamage: 90,
    bulletspeed: 1550,
    recharge: 2,
    reload: 10,
    bombdamage: 500,
    bomblifetime: 120,
    bombspeed: 1500,
    bombbounce: 1,
    bombradius: 230,
    abilitycd: 320
  },
  'ghost': {
    accel: 18,
    maxspeed: 650,
    turnspeed: 6,
    maxenergy: 200,
    bulletenergyuse: 45,
    bulletlifetime: 50,
    bulletdamage: 80,
    bulletspeed: 1650,
    recharge: 3,
    reload: 7,
    abilitycd: 0
  },
  'aurora': {
    accel: 17,
    maxspeed: 700,
    turnspeed: 7,
    maxenergy: 300,
    bulletenergyuse: 85,
    bulletlifetime: 32,
    bulletdamage: 60,
    bulletspeed: 1450,
    recharge: 2,
    reload: 14,
    minedamage: 200,
    minelifetime: 1000,
    mineradius: 200,
    abilitycd: 180,
    charges: 3
  },
  'training-dummy': {
    unplayable: true,
    accel: 20,
    maxspeed: 800,
    turnspeed: 8,
    maxenergy: 250,
    recharge: 1
  }
}

module.exports = {
  'stats': ships
};
