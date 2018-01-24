const marked = require('marked')
const bel = require('bel')
const raw = require('bel/raw')
const loadImage = require('image-promise')

const projectList = require('../routes/projects')

const scrollThreshold = 30
const sectionDelay = 1000
const debounceDelay = 100
const slideDuration = 500
const loadDelay = 500

const renderer = new marked.Renderer()
renderer.link = function( href, title, text ) {
  return '<a target="_blank" href="'+ href +'" title="' + title + '">' + text + '</a>'
}

function store (state, emitter) {
  state.projects = []
  state.sections = ['ABOUT', 'PROJECTS', 'ABOUT']
  state.classNames = [''],
  state.latch = false
  state.currentSection = 'PROJECTS'
  state.loopIndex = 0
  state.totalProjects = 0
  state.loadedImages = 0
  state.isPaused = false
  state.isLoaded = false
  state.touchOriginY = 0

  function dropLast(arr) {
    let result = [...arr]
    result.pop()
    return result
  }

  function dropFirst(arr) {
    let result = [...arr]
    result.shift()
    return result
  }

  function addAtFirst(arr, newItem) {
    let result = [...arr]
    result.unshift(newItem)
    return result
  }

  function addAtLast(arr, newItem) {
    return arr.concat(newItem)
  }

  function pause () {
    state.isPaused = true
  }

  function play () {
    state.isPaused = false
  }

  function scrollDeltaGate(latch, offset, threshold) {
    if (!latch) {
      offset > 0 + threshold ? emitter.emit('shiftDown') : null
      offset < 0 - threshold ? emitter.emit('shiftUp') : null
    }
  }

  emitter.on('DOMContentLoaded', DOMContentLoaded)
  emitter.on('shiftUp', shiftUp)
  emitter.on('shiftDown', shiftDown)
  emitter.on('play', play)
  emitter.on('pause', pause)
  emitter.on('handleSlideEnter', handleSlideEnter)
  emitter.on('handleSlideExit', handleSlideExit)
  emitter.on('handleScroll', handleScroll)
  emitter.on('handleTouchMove', handleTouchMove)
  emitter.on('handleTouchStart', handleTouchStart)

  function shiftUp () {
    state.latch = true
    state.classNames = ['moveUp']
    state.currentSection = state.sections[2]
    emitter.emit('render')
    setTimeout(() => {
      state.sections = dropFirst(state.sections)
      state.sections = addAtLast(state.sections, state.sections[0])
      state.classNames = ['reset']
      emitter.emit('render')
      setTimeout(() => state.latch = false, debounceDelay)
    }, sectionDelay)
  }

  function shiftDown () {
    state.latch = true
    state.classNames = ['moveDown']
    state.currentSection = state.sections[0]
    emitter.emit('render')
    setTimeout(() => {
      state.sections = dropLast(state.sections)
      state.sections = addAtFirst(state.sections, state.sections[1])
      state.classNames = ['reset']
      emitter.emit('render')
      setTimeout(() => state.latch = false, debounceDelay)
    }, sectionDelay)
  }

  function loop () {
    setTimeout(() => {
        window.requestAnimationFrame(loop)
        if (state.currentSection === 'PROJECTS' && !state.isPaused) {
          if (state.loopIndex < state.totalProjects - 1) {
            state.loopIndex = state.loopIndex + 1
          } else {
            state.loopIndex = 0
          }
         emitter.emit('render')
       }
    }, slideDuration)
  }


  function handleTouchMove(event) {
    const touch = event.touches[0] || event.changedTouches[0]
    const offset = touch.pageY - state.touchOriginY
    scrollDeltaGate(state.latch, offset, scrollThreshold)
  }

  function handleTouchStart(event) {
    const touch = event.touches[0] || event.changedTouches[0]
    state.touchOriginY = touch.pageY
  }

  function handleScroll(event) {
    scrollDeltaGate(state.latch, event.wheelDeltaY, scrollThreshold)
  }

  function handleSlideEnter() {
    pause()
    emitter.emit('render')
  }

  function handleSlideExit() {
    play()
    emitter.emit('render')
  }

  function makeHash() {
    return Math.random().toString(32).replace(/[^a-z]+/g, '').substr(0, 5)
  }

  function parseMarkdown (md) {
    const html = marked(md, { renderer:renderer })
    return bel`
      <div class='innerCaption'>
        ${raw(html)}
      </div>
    `
  }

  function DOMContentLoaded () {

    const promises = initialize(projectList)
    Promise.all(promises).then(projects => {
      state.projects = projects
      state.isLoaded = true
      requestAnimationFrame(() => loop())
    })
  }


  function initialize(projectList) {
    return projectList.map(p => {
      return preloadImage(p.src).then((img) => {
        ++state.totalProjects
        return (
          {
            key: makeHash(),
            img: img,
            cap: parseMarkdown(p.cap),
          }
        )
      })
    })
  }


  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
          resolve(img)
      }
      img.onerror = () => {
          reject(img)
      }
      img.src = 'assets/' + src
      img.className = 'slide-img'
    })
  }

}

module.exports = store
