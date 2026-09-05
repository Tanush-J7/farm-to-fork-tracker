import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Shield, ShieldAlert, User, Check, Edit, Save, X } from "lucide-react"
import { Button } from "../../components/ui/Button"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  wallet_address: string | null
}

export function AdminUsers() {
  const { token } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState("")

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setUsers(res.data.data)
      }
    } catch (error) {
      console.error("Failed to fetch users", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleUpdateRole = async (id: string) => {
    try {
      await axios.put(`${API}/admin/users/${id}/role`, { role: editRole }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setEditingId(null)
      fetchUsers()
    } catch (error) {
      alert("Failed to update role")
    }
  }

  if (loading) return <div className="p-8">Loading users...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Directory</h1>
        <p className="text-muted-foreground">Manage all users in the FarmChain ecosystem.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-slate-50 dark:bg-slate-900 border-b">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {editingId === u.id ? (
                        <select 
                          className="p-1 border rounded"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          {['admin', 'farmer', 'processor', 'distributor', 'retailer', 'consumer'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'} uppercase`}>
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === u.id ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-4 w-4"/></Button>
                          <Button size="sm" onClick={() => handleUpdateRole(u.id)}><Save className="h-4 w-4"/></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(u.id); setEditRole(u.role); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
