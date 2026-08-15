module.exports = {
  id: 'skills',
  channels: ['getSkills'],
  register({ handle, services }) {
    handle('getSkills', () => {
      const skillRuntime = services.getSkillRuntime()
      return {
        loaded: Boolean(skillRuntime?.registry.loaded),
        error: skillRuntime?.registry.loadError || null,
        pack: skillRuntime?.registry.pack,
        skills: skillRuntime?.registry.list() || []
      }
    })
  }
}
