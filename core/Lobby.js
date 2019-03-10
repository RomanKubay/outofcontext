const _ = require('lodash');

class Lobby {
  constructor() {
    do {
      this.code = _.sampleSize('abcdefghijklmnopqrstuvwxyz', 4).join('');
    } while(Lobby.lobbies[this.code]);
    this.members = [];
    this.players = [];
    this.spectators = [];
    this.selectedGame = '';
    this.maxPlayers = 0;
    this.admin = '';
    this.lobbyState = 'WAITING';
  }

  addMember(member) {
    this.members.push(member);
    this.updateMembers();
    this.sendLobbyInfo();
  }

  removeMember(member) {
    const i = this.members.indexOf(member);
    if(i >= 0)
      this.members.splice(i, 1);

    if(this.admin === member.id)
      this.admin = '';

    // Remove the player from the current players
    const playerObj = _.find(this.players, {id: member.id});
    if(playerObj) {
      playerObj.name = member.name;
      playerObj.connected = false;
      playerObj.member = null;
      playerObj.id = -1;
    }

    this.updateMembers();
    this.sendLobbyInfo();
  }

  /**
   * Determine if this lobby has any members
   * @return {boolean} True if there are no members
   */
  empty() {
    return this.members.length === 0;
  }

  /**
   * Emit a message to every member
   * @param  {args} args Arguments passed into emit
   */
  emitAll(...args) {
    for(const m of this.members) {
      m.socket.emit(...args);
    }
  }

  /**
   * Emit a message to every player
   * @param  {args} args Arguments passed into emit
   */
  emitPlayers(...args) {
    for(const p of this.players) {
      if(p.member)
        p.member.socket.emit(...args);
    }
  }

  updateMembers() {
    switch(this.lobbyState) {
    case 'WAITING':
      for(let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if(!p.connected) {
          this.players.splice(i--, 1);
        }
      }

      if(!this.maxPlayers || this.players.length < this.maxPlayers) {
        for(const m of this.members) {
          if(m.name && !this.players.find(p => p.id === m.id))
            this.players.push({
              id: m.id,
              name: m.name,
              member: m,
              connected: true,
            });
        }
      }

      if(!this.admin && this.players.length)
        this.admin = this.players[0].id;
      break;
    }
  }

  sendLobbyInfo() {
    const isPlayer = this.players.reduce((obj, p) => ({...obj, [p.id]: true}), {});
    const info = {
      currGame: this.selectedGame,
      admin: this.admin,
      members: this.members.map(m => ({
        id: m.id,
        name: m.name || false,
      })),
      players: this.players.map(p => ({
        id: p.id,
        connected: !!p.member,
        name: p.member ? p.member.name : p.name,
      })),
      spectators: this.members.filter(m => !isPlayer[m.id]).map(m => ({
        id: m.id,
        name: m.name,
      })),
    };

    this.emitAll('lobby:info', info);
  }
}

Lobby.lobbies = {};

Lobby.lobbyExists = code =>
  Lobby.lobbies.hasOwnProperty(code) && Lobby.lobbies[code];

module.exports = Lobby;