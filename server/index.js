import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'

const app = express()
const secret = process.env.JWT_SECRET || 'dev-only-change-me'
const now = () => new Date().toISOString()
let users = [{ id: 1, name: 'Aarav Mehta', email: 'student@gigcampus.test', password: bcrypt.hashSync('password123', 10), role: 'STUDENT', skills: ['React', 'Python', 'SQL', 'Pandas', 'Tailwind'] }, { id: 2, name: 'Pixel Club', email: 'client@gigcampus.test', password: bcrypt.hashSync('password123', 10), role: 'CLIENT', skills: [] }]
let gigs = [{ id: 1, title: 'Build a portfolio website', description: 'Create a responsive portfolio for our annual showcase.', category: 'Web Development', budget: 8000, deadline: '2026-08-30', skills: ['React', 'Tailwind'], clientId: 2, client: 'Pixel Club', status: 'OPEN', applicants: 0, createdAt: now() }]
let applications = [], messages = [], notifications = []

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const publicUser = ({ password, ...user }) => user
const tokenFor = user => jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' })
const auth = (req, res, next) => { try { req.user = jwt.verify(req.headers.authorization?.replace('Bearer ', ''), secret); next() } catch { res.status(401).json({ message: 'Sign in is required' }) } }
const role = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission for this action' })
const notify = (userId, type, text) => notifications.push({ id: Date.now(), userId, type, text, read: false, createdAt: now() })

app.get('/api/health', (_, res) => res.json({ ok: true, storage: 'memory' }))
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'STUDENT' } = req.body
  if (!name || !email || !password || !['STUDENT', 'CLIENT'].includes(role)) return res.status(400).json({ message: 'Name, email, password, and a valid role are required' })
  if (users.some(u => u.email === email)) return res.status(409).json({ message: 'Email is already registered' })
  const user = { id: users.length + 1, name, email, password: await bcrypt.hash(password, 10), role, skills: [] }
  users.push(user); res.status(201).json({ user: publicUser(user), token: tokenFor(user) })
})
app.post('/api/auth/login', async (req, res) => {
  const user = users.find(u => u.email === req.body.email)
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ message: 'Invalid email or password' })
  res.json({ user: publicUser(user), token: tokenFor(user) })
})
app.get('/api/gigs', (req, res) => {
  const { q = '', category, sort = 'newest' } = req.query
  let list = gigs.filter(g => g.status === 'OPEN' && (!category || g.category === category) && JSON.stringify(g).toLowerCase().includes(q.toLowerCase()))
  if (sort === 'budget') list.sort((a, b) => b.budget - a.budget)
  if (sort === 'deadline') list.sort((a, b) => a.deadline.localeCompare(b.deadline))
  res.json(list)
})
app.post('/api/gigs', auth, role('CLIENT'), (req, res) => {
  const { title, description, category, skills = [], budget, deadline, requirements = '' } = req.body
  if (!title || !description || !category || !budget || !deadline) return res.status(400).json({ message: 'Title, description, category, budget, and deadline are required' })
  const gig = { id: Date.now(), title, description, category, skills, budget: Number(budget), deadline, requirements, clientId: req.user.id, client: users.find(u => u.id === req.user.id).name, status: 'OPEN', applicants: 0, createdAt: now() }
  gigs.unshift(gig); res.status(201).json(gig)
})
app.get('/api/gigs/recommended', auth, role('STUDENT'), (req, res) => {
  const skills = users.find(u => u.id === req.user.id).skills.map(x => x.toLowerCase())
  res.json(gigs.filter(g => g.status === 'OPEN').map(g => ({ ...g, skillMatch: Math.round(100 * g.skills.filter(x => skills.includes(x.toLowerCase())).length / Math.max(g.skills.length, 1)) })).sort((a, b) => b.skillMatch - a.skillMatch))
})
app.post('/api/gigs/:id/applications', auth, role('STUDENT'), (req, res) => {
  const gig = gigs.find(g => g.id === Number(req.params.id))
  if (!gig || gig.status !== 'OPEN') return res.status(404).json({ message: 'Open gig not found' })
  if (applications.some(a => a.gigId === gig.id && a.studentId === req.user.id)) return res.status(409).json({ message: 'You already applied for this gig' })
  const application = { id: Date.now(), gigId: gig.id, studentId: req.user.id, proposal: req.body.proposal, bid: Number(req.body.bid), days: Number(req.body.days), status: 'PENDING', createdAt: now() }
  applications.push(application); gig.applicants += 1; notify(gig.clientId, 'NEW_APPLICATION', `New application for ${gig.title}`); res.status(201).json(application)
})
app.get('/api/gigs/:id/applications', auth, role('CLIENT'), (req, res) => res.json(applications.filter(a => a.gigId === Number(req.params.id)).map(a => ({ ...a, student: publicUser(users.find(u => u.id === a.studentId)) }))))
app.patch('/api/applications/:id', auth, role('CLIENT'), (req, res) => {
  const application = applications.find(a => a.id === Number(req.params.id)); const gig = application && gigs.find(g => g.id === application.gigId)
  if (!application || gig.clientId !== req.user.id) return res.status(404).json({ message: 'Application not found' })
  application.status = req.body.status === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED'
  if (application.status === 'ACCEPTED') { gig.status = 'IN_PROGRESS'; applications.filter(a => a.gigId === gig.id && a.id !== application.id).forEach(a => a.status = 'REJECTED') }
  notify(application.studentId, `APPLICATION_${application.status}`, `Your application for ${gig.title} was ${application.status.toLowerCase()}`); res.json({ application, gig })
})
app.patch('/api/gigs/:id/status', auth, (req, res) => {
  const gig = gigs.find(g => g.id === Number(req.params.id)); const allowed = ['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED']
  if (!gig || !allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid gig status' })
  if (req.user.role !== 'ADMIN' && req.user.id !== gig.clientId) return res.status(403).json({ message: 'Only the client can update this gig' })
  gig.status = req.body.status; res.json(gig)
})
app.get('/api/messages/:gigId', auth, (req, res) => res.json(messages.filter(m => m.gigId === Number(req.params.gigId))))
app.post('/api/messages/:gigId', auth, (req, res) => { const message = { id: Date.now(), gigId: Number(req.params.gigId), senderId: req.user.id, text: req.body.text, createdAt: now() }; messages.push(message); res.status(201).json(message) })
app.get('/api/notifications', auth, (req, res) => res.json(notifications.filter(n => n.userId === req.user.id)))
app.get('/api/admin/metrics', auth, role('ADMIN'), (_, res) => res.json({ users: users.length, students: users.filter(u => u.role === 'STUDENT').length, clients: users.filter(u => u.role === 'CLIENT').length, gigs: gigs.length, completed: gigs.filter(g => g.status === 'COMPLETED').length }))

app.listen(process.env.PORT || 4000, () => console.log(`GigCampus API running on http://localhost:${process.env.PORT || 4000}`))
