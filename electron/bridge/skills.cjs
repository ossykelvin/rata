module.exports = {
  id: 'skills',
  channels: ['getSkills'],
  create({ invoke }) {
    return { getSkills: () => invoke('getSkills') }
  }
}
