import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { ArrowLeft, User, Mail, Shield, Calendar, Phone, MapPin, Wallet, Package, BarChart3, Clock } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "https://farm-to-fork-tracker.onrender.com/api"

export function AdminUserDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [details, setDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`${API}/admin/users/${id}/details`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.data.success) {
          setDetails(res.data.data)
        }
      } catch (error) {
        console.error("Failed to fetch user details", error)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchDetails()
  }, [id, token])

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  if (!details) {
    return <div className="p-8 text-center text-red-500">Failed to load user profile.</div>
  }

  const { user, stats, products } = details

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Directory
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">User Profile</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Personal Info */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Account Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center py-4 border-b">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold mb-3">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-xl font-bold">{user.name}</h3>
                <span className="mt-1 px-3 py-1 rounded-full text-xs font-semibold uppercase bg-primary/20 text-primary">
                  {user.role.replace('pending_', 'pending ')}
                </span>
              </div>
              
              <div className="space-y-3 text-sm pt-2">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                {user.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Phone</p>
                      <p className="text-muted-foreground">{user.phone}</p>
                    </div>
                  </div>
                )}
                {user.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Address</p>
                      <p className="text-muted-foreground">{user.address}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Joined Date</p>
                    <p className="text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Wallet className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="w-full min-w-0">
                    <p className="font-medium text-foreground">Wallet Address</p>
                    <p className="text-muted-foreground font-mono text-xs break-all bg-slate-50 dark:bg-slate-900 p-2 rounded border mt-1">
                      {user.wallet_address || "Wallet-less Account"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Stats & Products */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Package className="h-5 w-5" /></div>
                  <p className="text-sm font-medium text-muted-foreground">Total Batches</p>
                </div>
                <p className="text-3xl font-bold">{stats.totalBatches}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><BarChart3 className="h-5 w-5" /></div>
                  <p className="text-sm font-medium text-muted-foreground">Total Volume</p>
                </div>
                <p className="text-3xl font-bold">{stats.totalQuantity.toLocaleString()} <span className="text-lg text-muted-foreground">kg</span></p>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg"><Shield className="h-5 w-5" /></div>
                  <p className="text-sm font-medium text-muted-foreground">Avg AI Quality</p>
                </div>
                <p className="text-3xl font-bold">{stats.avgQuality}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Product History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed">
                  No products found for this user.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-slate-50 dark:bg-slate-900 border-b">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">Product</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">AI Quality</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 rounded-tr-lg">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {products.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="px-4 py-3 font-medium">
                            {p.name}
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.batch_number}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${
                              p.status === 'Pending Approval' ? 'bg-slate-200 text-slate-600' : 
                              p.status === 'Harvested' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {p.ai_quality_label ? (
                              <span className={`font-semibold ${
                                p.ai_quality_label === 'Excellent' || p.ai_quality_label === 'Good' ? 'text-green-500' :
                                p.ai_quality_label === 'Poor' ? 'text-red-500' : 'text-yellow-500'
                              }`}>
                                {p.ai_quality_label} ({(p.ai_quality_score * 100).toFixed(0)}%)
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{p.quantity} kg</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
