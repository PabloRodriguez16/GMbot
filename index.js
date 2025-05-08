require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  Partials,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  const postulacionCanal = guild.channels.cache.find(c => c.name === '🅿postulación');
  if (!postulacionCanal) return;

  const mensajes = await postulacionCanal.messages.fetch({ limit: 10 });
  const yaExiste = mensajes.some(m => m.author.id === client.user.id && m.content.includes('postularte'));

  if (!yaExiste) {
    const boton = new ButtonBuilder()
      .setCustomId('postularme')
      .setLabel('📩 Postular')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(boton);

    await postulacionCanal.send({
      content: 'Para postularte a la empresa, presioná el botón de abajo. Se abrirá un canal privado donde deberás completar los datos solicitados.',
      components: [row],
    });
  }
});



client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const { guild, member, customId } = interaction;

  if (customId === 'postularme' || customId === 'postular_btn') {
    const canal = await guild.channels.create({
      name: `postulacion-${member.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...['📂 CEO', '📁 Director General', '🗂️ Gerente', '📝 RRHH'].map(nombre => {
          const rol = guild.roles.cache.find(r => r.name === nombre);
          return rol ? { id: rol.id, allow: [PermissionsBitField.Flags.ViewChannel] } : null;
        }).filter(Boolean)
      ]
    });

    await canal.send(
      '🔒 Bienvenido al proceso de postulación de **Gruppe Milk**.\n\nSomos una nueva empresa de seguridad con grandes aspiraciones. Nuestro objetivo es crecer y convertirnos en una referencia en el sector. Para lograrlo, necesitamos personas comprometidas, capaces y listas para enfrentar lo que viene. 💼🚨\n\n📌 *Se recuerda que los datos pedidos son IC.*\n\n```diff\nNombre y Apellido:\nEdad:\nNacionalidad:\nAños en la ciudad:\nComentar si tiene cargos penales:\nCapturas del F9 mostrando reportes y tickets:\n```'
    );
    const collector = canal.createMessageCollector({ filter: m => m.author.id === member.id, max: 1 });

    collector.on('collect', async () => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('aprobado').setLabel('✅ Aprobado').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('denegado').setLabel('❌ Denegado').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('revision').setLabel('🕐 En Revisión').setStyle(ButtonStyle.Secondary),
      );

      await canal.send({ content: 'Revisar postulación y seleccionar una opción:', components: [row] });
    });
  }

  if (['aprobado', 'denegado', 'revision'].includes(customId)) {
    const adminRoles = ['📂 CEO', '📁 Director General', '🗂️ Gerente', '📝 RRHH'];
    if (!member.roles.cache.some(r => adminRoles.includes(r.name))) {
      return interaction.reply({ content: 'No tenés permisos para usar este botón.', ephemeral: true });
    }

    const postulante = interaction.channel.permissionOverwrites.cache.find(po => po.allow.has(PermissionsBitField.Flags.SendMessages));
    if (!postulante) return;

    const user = await client.users.fetch(postulante.id);
    const guildMember = await interaction.guild.members.fetch(user.id);

    if (customId === 'aprobado') {
      const rol = interaction.guild.roles.cache.find(r => r.name === '🔺 Agente I');
      if (rol) await guildMember.roles.add(rol);
      await interaction.reply('✅ El postulante fue aprobado. Rol asignado.');

      const canalDatos = interaction.guild.channels.cache.find(channel => channel.name === '📝datos-de-empleado');
      if (canalDatos) {
        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('📄 Formulario de Ingreso - Gruppe Milk')
          .setDescription(
            '🛑 **Importante:** Todos los datos solicitados a continuación son **IC (In-Character)**.\n' +
            'Por favor, completá esta plantilla de manera clara y sin errores. Esta información será usada para evaluar tu ingreso oficial a la organización.\n\n' +
            '✍️ **Plantilla IC a completar:**\n\n' +
            '```yaml\n' +
            'Nombre:\n' +
            'Apellido:\n' +
            'Edad:\n' +
            'Nacionalidad:\n' +
            'Tiempo en la ciudad:\n' +
            'Experiencia laboral previa:\n' +
            'Posee licencia de conducir (Sí/No):\n' +
            'Posee licencia de armas (Sí/No):\n' +
            'Tiene antecedentes penales (Sí/No):\n' +
            'Comentarios adicionales:\n' +
            '```'
          )
          .setFooter({ text: 'Gruppe Milk - Seguridad y compromiso', iconURL: interaction.guild.iconURL() })
          .setTimestamp();

        const mensaje = await canalDatos.send({ embeds: [embed] });
        await mensaje.pin();
      }
    } else if (customId === 'denegado') {
      await guildMember.kick('Postulación denegada.');
      await interaction.reply('❌ El postulante fue expulsado del servidor.');
    } else if (customId === 'revision') {
      await interaction.reply('🕐 Postulación marcada como "En revisión".');
    }
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    const aspiranteRole = member.guild.roles.cache.find(role => role.name === '🔰 Aspirante');
    if (aspiranteRole) {
      await member.roles.add(aspiranteRole);
    }

    const bienvenidaCanal = member.guild.channels.cache.find(channel => channel.name === '👋visitas');
    if (bienvenidaCanal) {
      const embed = new EmbedBuilder()
        .setColor('#00AAFF')
        .setTitle(`¡Bienvenido, ${member.user.username}! 🎉`)
        .setDescription(`Por favor, pasa al canal de <#1368245252942463079> para postularte al equipo de Gruppe Milk.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Gruppe Milk - Seguridad y compromiso', iconURL: member.guild.iconURL() })
        .setTimestamp();

      await bienvenidaCanal.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error al asignar rol o enviar mensaje en canal de bienvenida:', error);
  }
});

client.once('ready', async () => {
  try {
    const reglasCanal = client.channels.cache.find(channel => channel.name === '📜reglas');
    
    if (!reglasCanal || !reglasCanal.isTextBased()) {
      console.error('No se encontró el canal de reglas o no es un canal de texto.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📜 Reglamento Interno de la Empresa')
      .setDescription('Lee atentamente estas normas para mantener un entorno respetuoso y profesional dentro del equipo.')
      .addFields(
        {
          name: '🚗 Cuidado de Vehículos',
          value: `• No abandonar vehículos en la calle.\n• No dejarlos sin gasolina ni rotos.\n• Reportar cualquier falla o daño inmediatamente.`
        },
        {
          name: '🤝 Respeto',
          value: `• Respeta a todos, sin importar su rango.\n• No se toleran actitudes agresivas, discriminación ni gritos.\n• Todos merecen ser escuchados.`
        },
        {
          name: '📈 Compromiso',
          value: `• Empleados destacados reciben **150,000 USD** de recompensa.\n• Para subir de rango:\n   1. 12 actividades registradas\n   2. 5 registros de cajeros\n• Para mantener el rango:\n   1. 10 actividades\n   2. 4 cajeros`
        },
        {
          name: '🗣️ Comunicación',
          value: `• Podés hablar con un superior ante cualquier incomodidad.\n• Se promueve un ambiente donde todos pueden expresarse.`
        },
        {
          name: '🧠 Otras Reglas de Sentido Común',
          value: `• Puntualidad y responsabilidad.\n• No usar recursos de la empresa para fines personales.\n• Mantener la limpieza y el orden.\n• No divulgar información interna sin autorización.`
        }
      )
      .setFooter({ text: 'Gruppe Milk - Seguridad y compromiso', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const mensaje = await reglasCanal.send({ embeds: [embed] });
    await mensaje.pin();

  } catch (error) {
    console.error('Error al enviar o fijar el mensaje de reglas:', error);
  }
});


client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (message.channel.name === '📝datos-de-empleado') {
      
      const mensajes = await message.channel.messages.fetch({ limit: 2 });
      const mensajeAnterior = mensajes.first();
      
      if (mensajeAnterior && mensajeAnterior.author.bot) {
        await mensajeAnterior.delete();
      }

      const embed = new EmbedBuilder()
  .setColor('#00AAFF')
  .setTitle('Plantilla de Datos de Empleado')
  .setDescription('Aquí puedes encontrar la plantilla para ingresar los datos necesarios para tu postulación.')
  .addFields(
    { name: 'Nombre Completo', value: '—' },
    { name: 'Edad', value: '—' },
    { name: 'Nacionalidad', value: '—' }
  )
  .setFooter({ text: 'Recuerda completar los datos correctamente', iconURL: client.user.displayAvatarURL() })
  .setTimestamp();


      await message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error al gestionar el mensaje:', error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (message.channel.name === '📅bitácora-de-actividades') {

      const embed = new EmbedBuilder()
        .setColor('#00AAFF')
        .setTitle('Datos necesarios para un correcto informe 📋')
        .setDescription('Por favor, completa los siguientes datos para un informe adecuado:')
        .addFields(
          { name: 'Nombre de quien la realizó', value: '—' },
          { name: 'Nombre y número de la actividad', value: '—' },
          { name: 'Fecha', value: '—' },
          { name: 'Foto', value: '—' }
        )
        .setImage('https://i.postimg.cc/52gF775r/image.png')
        .setFooter({ text: 'Gracias por tu colaboración', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });

      if (message.attachments.size > 0) {
        await message.react('✅');
      } else {
        const warningEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('⚠ Advertencia')
          .setDescription('No se ha enviado una imagen. Por favor, recuerda incluir una foto junto con la plantilla.')
          .setFooter({ text: 'Recuerda seguir la plantilla correctamente.', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await message.channel.send({ embeds: [warningEmbed] });
      }
    }
  } catch (error) {
    console.error('Error al gestionar el mensaje:', error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (message.channel.name === '💳registro-de-cajeros') {
      const embed = new EmbedBuilder()
        .setColor('#00AAFF')
        .setTitle('Registro de Cajeros🚛 - Datos requeridos')
        .setDescription('Por favor, completa los siguientes datos:')
        .addFields(
          { name: 'Nombre del cajero', value: '—' },
          { name: 'Turno', value: '—' },
          { name: 'Fecha', value: '—' },
          { name: 'Foto del cierre', value: '—' }
        )
        .setImage('https://i.postimg.cc/52gF775r/image.png')
        .setFooter({ text: 'Gracias por registrar la información.', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });

      if (message.attachments.size > 0) {
        await message.react('✅');
        await message.react('🚛');
      } else {
        const warningEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('⚠ Advertencia')
          .setDescription('No se ha enviado una imagen del cierre. Por favor, recuerda incluir una foto.')
          .setFooter({ text: 'Registro incompleto.', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await message.channel.send({ embeds: [warningEmbed] });
      }
    }
  } catch (error) {
    console.error('Error al gestionar el mensaje:', error);
  }
});

client.once('ready', async () => {
  try {
    const canalCarnet = client.channels.cache.find(channel => channel.name === '🚗foto-carnet-conducir');

    if (!canalCarnet || !canalCarnet.isTextBased()) {
      console.error('No se encontró el canal 🚗foto-carnet-conducir o no es un canal de texto.');
      return;
    }

    await canalCarnet.send('Para continuar en el proceso de selección necesitas enviar una foto de tu carnet de conducir.');

    const embed = new EmbedBuilder()
      .setColor('#00AAFF')
      .setTitle('📸 Foto del Carnet de Conducir')
      .setDescription('La imagen debe mostrar todos los datos del carnet y tiene que estar sin vencer.\n\nEn caso de que haya vencido, se le pedirá que lo renueve cuanto antes para proseguir.')
      .setImage('https://cdn.discordapp.com/attachments/1361765019188199434/1369099052159074435/image.png?ex=681c9a9a&is=681b491a&hm=b49fc5e9c5c05d5600c1334734857fd25752fd0be89c3900c438c7ee82b83ba6&') // Imagen de ejemplo
      .setFooter({ text: 'Gruppe Milk - Proceso de Selección', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const mensaje = await canalCarnet.send({ embeds: [embed] });
    await mensaje.pin();

  } catch (error) {
    console.error('Error al enviar o fijar el mensaje del carnet de conducir:', error);
  }
});

client.once('ready', async () => {
  try {
    const canalGuia = client.channels.cache.find(channel => channel.name === '🗺guía-de-cargas');

    if (!canalGuia || !canalGuia.isTextBased()) {
      console.error('No se encontró el canal 🗺guía-de-cargas o no es un canal de texto.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00B894')
      .setTitle('📌 Guía de Cargas - Bienvenida')
      .setDescription(
        `¡Bienvenido a la **🗺guía-de-cargas**!\n\n` +
        `En este canal encontrarás:\n` +
        `• Ubicaciones clave al momento de hacer actividades\n` +
        `• Consejos importantes para realizarlas correctamente\n` +
        `• Otra información relevante que iremos actualizando\n\n` +
        `---\n\n` +
        `📍 **Ubicación para reabastecer alarmas a los vehículos**\n` +
        `En muchas empresas del rubro la pregunta *"¿Dónde repongo las alarmas?"* es muy frecuente.\n` +
        `Aquí tienes la ubicación exacta para hacerlo:`
      )
      .setImage('https://cdn.discordapp.com/attachments/1361765019188199434/1369786885454561441/GTA5_mVIHoyeHH3.jpg?ex=681d20f2&is=681bcf72&hm=f4db8e25dfee439e0e7005c8521fad65b5650555b8612aa06f0e0bd119669691&') // Link de ejemplo
      .setFooter({ text: 'Gruppe Milk - Información útil para tus actividades', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const mensaje = await canalGuia.send({ embeds: [embed] });
    await mensaje.pin();

  } catch (error) {
    console.error('Error al enviar o fijar el mensaje en guía-de-cargas:', error);
  }
});

client.once('ready', async () => {
  try {
    const canalVehiculos = client.channels.cache.find(channel => channel.name === '🚙vehículos');

    if (!canalVehiculos || !canalVehiculos.isTextBased()) {
      console.error('No se encontró el canal 🚙vehículos o no es un canal de texto.');
      return;
    }

    const embedPrincipal = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🚙 Flota de Vehículos Operativos')
      .setDescription(
        `En este canal encontrarás información detallada sobre los vehículos habilitados por la empresa.\n` +
        `Cada uno está equipado y asignado para tareas específicas relacionadas a nuestras operaciones.\n` +
        `Por favor, usalos de forma responsable y reportá cualquier daño o incidente.`
      )
      .setFooter({ text: 'Gruppe Milk - Uso responsable de recursos', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const embedDilettante = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🚗 Dilettante')
      .setDescription(
        `• Vehículo liviano, ágil y de 4 puertas.\n` +
        `• Ideal para tareas rápidas y urbanas.\n` +
        `• Equipado con herramientas para:\n` +
        `   - Instalación de alarmas\n` +
        `   - Reparación de alarmas\n` +
        `   - Revisión de puntos de seguridad\n` +
        `• Recomendado para operativos con poca carga y alta movilidad.`
      )
      .setImage('https://cdn.discordapp.com/attachments/1361765019188199434/1369790002443321344/image.png?ex=681d23da&is=681bd25a&hm=15fc9bb36868c851a13df01b623590a24b7eb7257f5241711f2beb959d62f5d4&');

    const embedStockade = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('🚛 Stockade')
      .setDescription(
        `• Vehículo blindado de gran tamaño y resistencia.\n` +
        `• Capaz de transportar mercancías delicadas y de alto valor.\n` +
        `• Equipado para:\n` +
        `   - Instalación de alarmas\n` +
        `   - Reabastecimiento de cajeros automáticos\n` +
        `   - Encargos especiales que requieren protección\n` +
        `• Ideal para operativos largos o en zonas de alto riesgo.`
      )
      .setImage('https://cdn.discordapp.com/attachments/1361765019188199434/1369790076271202304/image.png?ex=681d23eb&is=681bd26b&hm=eb749089804942006e5b8d5b4c41bbce5425f0a54d01d827a4543a64cb89d002&');

    const mensaje = await canalVehiculos.send({ embeds: [embedPrincipal, embedDilettante, embedStockade] });
    await mensaje.pin();

  } catch (error) {
    console.error('Error al enviar o fijar el mensaje en el canal de vehículos:', error);
  }
});

client.once('ready', async () => {
  try {
    const canalUniformes = client.channels.cache.find(channel => channel.name === '👕uniformes');

    if (!canalUniformes || !canalUniformes.isTextBased()) {
      console.error('No se encontró el canal 👕uniformes o no es un canal de texto.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#1ABC9C')
      .setTitle('👕 Uniforme Oficial del Equipo')
      .setDescription(
        `Este es el uniforme designado para los miembros activos del equipo.\n` +
        `Debe utilizarse durante todas las actividades oficiales de la empresa.\n` +
        `El uniforme asegura una imagen profesional, facilita la identificación y fomenta la unidad del equipo.\n\n` +
        `A continuación, se detallan cada una de las prendas con su respectivo estilo y color.`
      )
      .addFields(
        {
          name: '🧢 Gorra (opcional)',
          value:
            `• Estilo: Gorra hacia adelante\n` +
            `• Color: Blanco\n` +
            `• Se permite solo si no interfiere con otros elementos del uniforme.`
        },
        {
          name: '👕 Camisa',
          value:
            `• Estilo: Camiseta tipo Polo\n` +
            `• Color: Negra con letras blancas\n` +
            `• Obligatoria para todas las actividades de campo y operativos.`
        },
        {
          name: '👖 Pantalón',
          value:
            `• Estilo: Pantalón de trabajo arremangado 2\n` +
            `• Color: Blanco\n` +
            `• Debe mantenerse limpio y sin roturas.`
        },
        {
          name: '🥾 Calzado',
          value:
            `• Estilo: Botas de montaña 2\n` +
            `• Color: Blanco (#11)\n` +
            `• Asegura estabilidad y protección durante las tareas.`
        }
      )
      .setImage('https://example.com/imagen-uniforme-1.jpg') // Imagen general del uniforme
      .setThumbnail('https://example.com/imagen-uniforme-2.jpg') // Primer plano de camisa o gorra
      .setFooter({ text: 'Gruppe Milk - Identidad y profesionalismo', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const mensaje = await canalUniformes.send({
      embeds: [embed],
      files: [
        'https://example.com/imagen-uniforme-1.jpg', // Imagen general del uniforme
        'https://example.com/imagen-uniforme-2.jpg', // Imagen frontal
        'https://example.com/imagen-uniforme-3.jpg'  // Imagen detalle de botas o pantalón
      ]
    });

    await mensaje.pin();

  } catch (error) {
    console.error('Error al enviar o fijar el mensaje de uniformes:', error);
  }
});


client.login(process.env.TOKEN);
