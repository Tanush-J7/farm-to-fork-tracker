import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { User, Edit, Save, X, Trash2, Download, Search, Eye } from "lucide-react"
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
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")

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

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user?")) return;
    try {
      await axios.delete(`${API}/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchUsers()
    } catch (error) {
      alert("Failed to delete user")
    }
  }

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Email", "Role", "Joined Date", "Wallet Address"]
    const csvContent = [
      headers.join(","),
      ...users.map(u => [
        u.id,
        `"${u.name}"`,
        `"${u.email}"`,
        u.role,
        new Date(u.created_at).toISOString(),
        u.wallet_address || "None"
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `farmchain_users_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    let matchesRole = false;
    if (roleFilter === "all") matchesRole = true;
    else if (roleFilter === "pending") matchesRole = u.role.startsWith("pending_");
    else matchesRole = u.role === roleFilter;

    return matchesSearch && matchesRole
  })

  if (loading) return <div className="p-8">Loading users...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Directory</h1>
          <p className="text-muted-foreground">Manage all users in the FarmChain ecosystem.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
          <CardTitle>Registered Users ({filteredUsers.length})</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name or email..."
                className="w-full pl-8 pr-4 py-2 text-sm border rounded-md bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="farmer">Farmer</option>
              <option value="processor">Processor</option>
              <option value="distributor">Distributor</option>
              <option value="retailer">Retailer</option>
              <option value="consumer">Consumer</option>
              <option value="pending">Pending Approval</option>
            </select>
          </div>
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
                {filteredUsers.map(u => (
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
                          {u.role.replace('pending_', 'pending ')}
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
                        <div className="flex justify-end gap-1">
                          {u.role.startsWith('pending_') && (
                            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-600 mr-2" onClick={async () => {
                               try {
                                 await axios.put(`${API}/admin/users/${u.id}/role`, { role: u.role.replace('pending_', '') }, {
                                   headers: { Authorization: `Bearer ${token}` }
                                 });
                                 fetchUsers();
                               } catch { alert('Failed to approve user'); }
                            }}>
                              Approve
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/users/${u.id}`)}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(u.id); setEditRole(u.role); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found matching your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
