export interface ExpansionDef {
  id: string;
  name: string;
  price: number;
  coat: CoatStyle;
  theme: Theme;
}

export type CoatStyle = 'orange' | 'sable' | 'tricolor' | 'merle' | 'blacktan' | 'brindle' | 'cream';
export type Theme =
  | 'royal' | 'aviator' | 'pirate' | 'tuxedo' | 'safari' | 'samurai' | 'viking' | 'magician'
  | 'astronaut' | 'chef' | 'detective' | 'rockstar' | 'racer' | 'steampunk' | 'dragonKnight' | 'reindeer'
  | 'ninja' | 'mariachi' | 'lifeguard' | 'surfer' | 'painter' | 'gardener' | 'pharaoh' | 'spaceCaptain';
