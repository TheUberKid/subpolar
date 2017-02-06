var ships = {
  "falcon": {
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
    abilitycd: 200
  },
  "lancaster": {
    accel: 15,
    maxspeed: 700,
    turnspeed: 6,
    maxenergy: 250,
    bulletenergyuse: 70,
    bulletlifetime: 60,
    bulletdamage: 100,
    bulletspeed: 1500,
    recharge: 2,
    reload: 10,
    bombenergyuse: 240,
    bombdamage: 500,
    bomblifetime: 120,
    bombspeed: 1400,
    bombbounce: 1,
    bombradius: 230,
    abilitycd: 200
  },
  "ghost": {
    accel: 18,
    maxspeed: 650,
    turnspeed: 6,
    maxenergy: 200,
    bulletenergyuse: 45,
    bulletlifetime: 50,
    bulletdamage: 80,
    bulletspeed: 1600,
    recharge: 3,
    reload: 7,
    abilitycd: 0
  },
  "aurora": {
    accel: 15,
    maxspeed: 750,
    turnspeed: 6,
    maxenergy: 250,
    bulletenergyuse: 45,
    bulletlifetime: 50,
    bulletdamage: 80,
    bulletspeed: 1600,
    recharge: 3,
    reload: 7,
    mineenergyuse: 20,
    minedamage: 160,
    minelifetime: 1200,
    mineradius: 150,
    abilitycd: 20
  }
}

module.exports = {
  "stats": ships
};
