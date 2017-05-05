var ships = {
  'warbird': {
    accel: 20,
    maxspeed: 800,
    turnspeed: 8,
    maxenergy: 400,
    bulletenergyuse: 260,
    bulletlifetime: 100,
    bulletdamage: 420,
    bulletspeed: 1800,
    recharge: 2.2,
    reload: 30,
    abilitycd: 220
  },
  'lancaster': {
    accel: 16,
    maxspeed: 720,
    turnspeed: 6,
    maxenergy: 420,
    bulletenergyuse: 70,
    bulletlifetime: 60,
    bulletdamage: 100,
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
    maxenergy: 340,
    bulletenergyuse: 40,
    bulletlifetime: 50,
    bulletdamage: 96,
    bulletspeed: 1650,
    recharge: 2.6,
    reload: 7,
    abilitycd: 0
  },
  'aurora': {
    accel: 17,
    maxspeed: 700,
    turnspeed: 7,
    maxenergy: 400,
    bulletenergyuse: 80,
    bulletlifetime: 32,
    bulletdamage: 75,
    bulletspeed: 1450,
    recharge: 2,
    reload: 14,
    minedamage: 200,
    minelifetime: 1000,
    mineradius: 200,
    abilitycd: 150,
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
