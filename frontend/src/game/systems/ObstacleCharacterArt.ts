import Phaser from 'phaser';

export type CharacterObstacleSkin =
  | 'obstacle_boy'
  | 'obstacle_girl'
  | 'obstacle_mean_dog';

/**
 * Procedural, original cartoon artwork for the three character obstacles.
 * These are texture-only visuals; validated obstacle dimensions and hitboxes
 * remain controlled by the existing hurdle generator.
 */
export function buildCharacterObstacleTextures(scene: Phaser.Scene): void {
  const make = (
    key: CharacterObstacleSkin,
    width: number,
    height: number,
    draw: (graphics: Phaser.GameObjects.Graphics) => void,
  ): void => {
    if (scene.textures.exists(key)) return;
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  };

  make('obstacle_boy', 140, 210, (g) => {
    // Shoes and legs.
    g.fillStyle(0x24304a, 1);
    g.fillRoundedRect(24, 184, 42, 18, 8);
    g.fillRoundedRect(75, 184, 42, 18, 8);
    g.fillStyle(0x315b9b, 1);
    g.fillRoundedRect(35, 142, 23, 48, 9);
    g.fillRoundedRect(82, 142, 23, 48, 9);

    // Shirt and playful raised arms.
    g.fillStyle(0x2f8ee5, 1);
    g.fillRoundedRect(27, 82, 86, 72, 20);
    g.fillStyle(0xf2b98d, 1);
    g.fillRoundedRect(8, 86, 26, 58, 12);
    g.fillRoundedRect(106, 66, 26, 70, 12);
    g.fillCircle(20, 84, 13);
    g.fillCircle(119, 62, 13);

    // Head and ears.
    g.fillCircle(70, 52, 40);
    g.fillCircle(31, 55, 10);
    g.fillCircle(109, 55, 10);

    // Brown hair.
    g.fillStyle(0x6b3f25, 1);
    g.fillCircle(42, 27, 19);
    g.fillCircle(67, 19, 23);
    g.fillCircle(93, 27, 19);
    g.fillRoundedRect(32, 24, 76, 18, 8);

    // Face.
    g.fillStyle(0x18223a, 1);
    g.fillCircle(56, 54, 4);
    g.fillCircle(84, 54, 4);
    g.lineStyle(4, 0x18223a, 1);
    g.strokeCircle(70, 67, 10);
    g.fillStyle(0xf2b98d, 1);
    g.fillRect(55, 57, 30, 13);
  });

  make('obstacle_girl', 140, 210, (g) => {
    // Shoes and legs.
    g.fillStyle(0x5e315f, 1);
    g.fillRoundedRect(25, 184, 40, 18, 8);
    g.fillRoundedRect(76, 184, 40, 18, 8);
    g.fillStyle(0xf2b98d, 1);
    g.fillRoundedRect(38, 148, 18, 42, 9);
    g.fillRoundedRect(84, 148, 18, 42, 9);

    // Dress and waving arms.
    g.fillStyle(0xe85d9e, 1);
    g.fillTriangle(70, 78, 20, 164, 120, 164);
    g.fillRoundedRect(40, 77, 60, 55, 18);
    g.fillStyle(0xf2b98d, 1);
    g.fillRoundedRect(12, 88, 25, 58, 12);
    g.fillRoundedRect(104, 70, 25, 72, 12);
    g.fillCircle(24, 85, 13);
    g.fillCircle(117, 66, 13);

    // Hair behind head.
    g.fillStyle(0x5a321e, 1);
    g.fillRoundedRect(28, 28, 84, 86, 34);
    g.fillCircle(35, 85, 18);
    g.fillCircle(105, 85, 18);

    // Head.
    g.fillStyle(0xf2b98d, 1);
    g.fillCircle(70, 53, 39);
    g.fillCircle(32, 56, 9);
    g.fillCircle(108, 56, 9);

    // Brown fringe and pigtail bows.
    g.fillStyle(0x5a321e, 1);
    g.fillCircle(48, 27, 19);
    g.fillCircle(72, 20, 22);
    g.fillCircle(94, 29, 18);
    g.fillStyle(0xffd45c, 1);
    g.fillTriangle(24, 65, 8, 53, 9, 77);
    g.fillTriangle(116, 65, 132, 53, 131, 77);

    // Face.
    g.fillStyle(0x18223a, 1);
    g.fillCircle(56, 54, 4);
    g.fillCircle(84, 54, 4);
    g.lineStyle(4, 0x18223a, 1);
    g.strokeCircle(70, 67, 10);
    g.fillStyle(0xf2b98d, 1);
    g.fillRect(55, 57, 30, 13);
  });

  make('obstacle_mean_dog', 160, 190, (g) => {
    // Paws and seated body.
    g.fillStyle(0x3a2f2a, 1);
    g.fillRoundedRect(25, 158, 44, 24, 10);
    g.fillRoundedRect(91, 158, 44, 24, 10);
    g.fillStyle(0x7b5137, 1);
    g.fillEllipse(80, 126, 104, 94);
    g.fillRoundedRect(43, 126, 28, 44, 12);
    g.fillRoundedRect(89, 126, 28, 44, 12);

    // Head and pointed ears.
    g.fillStyle(0x8d6041, 1);
    g.fillCircle(80, 65, 52);
    g.fillTriangle(40, 35, 31, 2, 67, 22);
    g.fillTriangle(93, 22, 129, 2, 120, 38);
    g.fillStyle(0x4a3124, 1);
    g.fillTriangle(43, 29, 38, 11, 59, 23);
    g.fillTriangle(101, 23, 122, 11, 117, 31);

    // Mean eyebrows and eyes.
    g.lineStyle(8, 0x18223a, 1);
    g.lineBetween(48, 49, 70, 58);
    g.lineBetween(90, 58, 112, 49);
    g.fillStyle(0xffd45c, 1);
    g.fillCircle(61, 63, 7);
    g.fillCircle(99, 63, 7);
    g.fillStyle(0x18223a, 1);
    g.fillCircle(61, 63, 3);
    g.fillCircle(99, 63, 3);

    // Muzzle, nose, growl and teeth.
    g.fillStyle(0xc69672, 1);
    g.fillEllipse(80, 91, 70, 48);
    g.fillStyle(0x18223a, 1);
    g.fillTriangle(68, 79, 92, 79, 80, 91);
    g.lineStyle(5, 0x18223a, 1);
    g.lineBetween(80, 90, 80, 101);
    g.lineBetween(57, 104, 103, 104);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(62, 104, 70, 104, 66, 117);
    g.fillTriangle(90, 104, 98, 104, 94, 117);

    // Spiked collar.
    g.fillStyle(0xd94141, 1);
    g.fillRoundedRect(39, 112, 82, 18, 8);
    g.fillStyle(0xffd45c, 1);
    g.fillTriangle(50, 129, 60, 129, 55, 141);
    g.fillTriangle(75, 129, 85, 129, 80, 141);
    g.fillTriangle(100, 129, 110, 129, 105, 141);
  });
}
